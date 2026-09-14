import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  decodeTimeZoneId,
  decodeOneDayBackup,
  isDomainError,
  type BackupDataV1,
} from '../src/domain';
import { ReminderRuntime, type ReminderDelivery } from '../src/application';
import { accountMethods, createServices } from '../src/application/services';
import {
  AccountUnitOfWork,
  emptyAccountData,
} from '../src/infrastructure/account/unit-of-work';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'one_day_session';
const credentialsSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,32}$/),
    password: z.string().min(10).max(128),
    timeZone: z.string().max(100).optional(),
  })
  .strict();
const rpcSchema = z
  .object({ service: z.string(), method: z.string(), args: z.array(z.unknown()).max(5) })
  .strict();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const passwordHash = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function readJson(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json'))
    throw new HttpError(415, '请求必须使用 JSON');
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > 5 * 1024 * 1024)
      throw new HttpError(413, '文件过大，请使用不超过 5 MB 的备份');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
  } catch {
    throw new HttpError(400, '请求内容无效');
  }
}
function tokenOf(request: IncomingMessage): string {
  return (
    request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? ''
  );
}
interface User {
  id: string;
  username: string;
}
interface StoredData {
  payload: string;
  revision: number;
  legacy_choice: number;
}

export function createAccountApi(
  options: {
    databasePath?: string;
    origin?: string;
    secureCookies?: boolean;
    now?: () => number;
  } = {},
) {
  const databasePath =
    options.databasePath ??
    process.env.ONE_DAY_DATABASE ??
    resolve('data/one-day.sqlite');
  if (databasePath !== ':memory:')
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS account_data (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, legacy_choice INTEGER NOT NULL DEFAULT 0);`);
  const now = options.now ?? Date.now;
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === 'production';
  const configuredOrigin = options.origin ?? process.env.ONE_DAY_ORIGIN;
  const attempts = new Map<string, { count: number; until: number }>();
  const queues = new Map<string, Promise<unknown>>();
  const serial = async <T>(id: string, work: () => Promise<T>): Promise<T> => {
    const prior = queues.get(id) ?? Promise.resolve();
    const current = prior.catch(() => undefined).then(work);
    queues.set(id, current);
    try {
      return await current;
    } finally {
      if (queues.get(id) === current) queues.delete(id);
    }
  };
  const rateLimit = (key: string, max: number) => {
    const time = now();
    for (const [name, entry] of attempts) if (entry.until <= time) attempts.delete(name);
    const entry = attempts.get(key) ?? { count: 0, until: time + 15 * 60 * 1000 };
    if (++entry.count > max || attempts.size > 10000)
      throw new HttpError(429, '尝试次数过多，请 15 分钟后重试');
    attempts.set(key, entry);
  };
  const session = (request: IncomingMessage): User => {
    const user = db
      .prepare(
        'SELECT u.id, u.username FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',
      )
      .get(hash(tokenOf(request)), now()) as unknown as User | undefined;
    if (!user) throw new HttpError(401, '登录已失效，请重新登录');
    const expected = request.headers['x-one-day-user'];
    if (expected && expected !== user.id)
      throw new HttpError(401, '账号已在其他页面切换，请重新登录');
    return user;
  };
  const cookie = (response: ServerResponse, token: string, maxAge: number) =>
    response.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`,
    );
  const signIn = (request: IncomingMessage, response: ServerResponse, user: User) => {
    const token = randomBytes(32).toString('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM sessions WHERE token_hash=? OR expires_at<=?').run(
        hash(tokenOf(request)),
        now(),
      );
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
        hash(token),
        user.id,
        now() + SESSION_MS,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    cookie(response, token, SESSION_MS / 1000);
    return { user };
  };
  const load = (id: string) =>
    db
      .prepare('SELECT payload,revision,legacy_choice FROM account_data WHERE user_id=?')
      .get(id) as unknown as StoredData;
  const commit = (
    id: string,
    old: StoredData,
    data: BackupDataV1,
    legacyChoice = old.legacy_choice,
  ) => {
    // Validate references before persisting; IDs are scoped by the authenticated owner.
    const checked = decodeOneDayBackup({
      format: 'one-day-backup',
      version: 1,
      exportedAt: new Date(now()).toISOString(),
      timeZone: data.settings.applicationTimeZone,
      data,
    });
    const payload = JSON.stringify(checked.data);
    if (payload === old.payload && legacyChoice === old.legacy_choice)
      return old.revision;
    const result = db
      .prepare(
        'UPDATE account_data SET payload=?,revision=revision+1,legacy_choice=? WHERE user_id=? AND revision=?',
      )
      .run(payload, legacyChoice, id, old.revision);
    if (!result.changes) throw new HttpError(409, '数据刚被另一请求更新，请刷新后重试');
    return old.revision + 1;
  };
  async function route(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<unknown> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method === 'GET' && path === '/api/session') {
      const user = session(request);
      const data = load(user.id);
      return {
        user,
        revision: data.revision,
        legacyChoiceMade: Boolean(data.legacy_choice),
      };
    }
    if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
    // Custom header + JSON prevent cross-origin form requests; never enable CORS for this API.
    if (request.headers['x-one-day-request'] !== '1')
      throw new HttpError(403, '请求来源无效');
    const expectedOrigin = configuredOrigin ?? `http://${request.headers.host ?? ''}`;
    if (request.headers.origin !== expectedOrigin)
      throw new HttpError(403, '请求来源无效');
    if (path === '/api/register' || path === '/api/login') {
      rateLimit(`ip:${request.socket.remoteAddress ?? 'unknown'}`, 40);
      const parsed = credentialsSchema.safeParse(await readJson(request));
      if (!parsed.success)
        throw new HttpError(
          400,
          '账号需为 3–32 位小写字母、数字或下划线；密码需为 10–128 位',
        );
      const { username, password } = parsed.data;
      rateLimit(`user:${username}`, 15);
      const existing = db
        .prepare('SELECT * FROM users WHERE username=?')
        .get(username) as
        { id: string; username: string; salt: string; password_hash: string } | undefined;
      if (path === '/api/register') {
        const salt = randomBytes(16).toString('hex');
        const passwordKey = await passwordHash(password, salt);
        if (existing || db.prepare('SELECT id FROM users WHERE username=?').get(username))
          throw new HttpError(409, '此账号已被使用，请登录或更换账号');
        const user = { id: randomUUID(), username };
        const data = emptyAccountData(decodeTimeZoneId(parsed.data.timeZone ?? 'UTC'));
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
            user.id,
            username,
            salt,
            passwordKey.toString('hex'),
          );
          db.prepare('INSERT INTO account_data(user_id,payload) VALUES (?,?)').run(
            user.id,
            JSON.stringify(data),
          );
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        return signIn(request, response, user);
      }
      const derived = await passwordHash(
        password,
        existing?.salt ?? '00000000000000000000000000000000',
      );
      const expected = Buffer.from(existing?.password_hash ?? '00'.repeat(64), 'hex');
      if (!timingSafeEqual(derived, expected) || !existing)
        throw new HttpError(401, '账号或密码不正确');
      return signIn(request, response, { id: existing.id, username: existing.username });
    }
    const user = session(request);
    if (!request.headers['x-one-day-user']) throw new HttpError(403, '缺少账号上下文');
    if (path === '/api/logout') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(tokenOf(request)));
      cookie(response, '', 0);
      return { ok: true };
    }
    const input = await readJson(request);
    return serial(user.id, async () => {
      // Recheck after waiting: logout must revoke queued operations too.
      session(request);
      const stored = load(user.id);
      const unit = new AccountUnitOfWork(JSON.parse(stored.payload) as BackupDataV1);
      const services = createServices(unit, () => unit.data.settings.applicationTimeZone);
      if (path === '/api/legacy') {
        const choice = z.object({ backup: z.unknown().optional() }).strict().parse(input);
        if (stored.legacy_choice) throw new HttpError(409, '此账号已处理过旧数据导入');
        if (choice.backup !== undefined) {
          const data = unit.data;
          if (
            data.singleTasks.length ||
            data.recurrenceSeries.length ||
            data.tags.length ||
            data.longTermGoals.length ||
            data.lists.length > 1
          )
            throw new HttpError(
              409,
              '当前账号已有数据，请先导出旧数据，再在设置中选择备份恢复',
            );
          await services.backup.restore(
            services.backup.inspect(JSON.stringify(choice.backup)),
          );
        }
        return { revision: commit(user.id, stored, unit.data, 1) };
      }
      if (path === '/api/reminders/poll') {
        const deliveries: ReminderDelivery[] = [];
        const runtime = new ReminderRuntime(unit, {
          deliver: (delivery) => {
            deliveries.push(delivery);
          },
        });
        await runtime.reconcile();
        return { deliveries, revision: commit(user.id, stored, unit.data) };
      }
      if (path !== '/api/rpc') throw new HttpError(404, '接口不存在');
      const call = rpcSchema.parse(input);
      const allowed = Object.hasOwn(accountMethods, call.service)
        ? (accountMethods[
            call.service as keyof typeof accountMethods
          ] as readonly string[])
        : [];
      if (!allowed.includes(call.method)) throw new HttpError(404, '接口不存在');
      const instance = services[call.service as keyof typeof services];
      const method = (
        instance as unknown as Record<string, (...args: unknown[]) => unknown>
      )[call.method];
      const result = await method!.apply(instance, call.args);
      session(request);
      return { result, revision: commit(user.id, stored, unit.data) };
    });
  }
  return {
    close: () => db.close(),
    handle: (request: IncomingMessage, response: ServerResponse) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      void route(request, response)
        .then((result) => response.end(JSON.stringify(result)))
        .catch((error: unknown) => {
          response.statusCode =
            error instanceof HttpError
              ? error.status
              : isDomainError(error) || error instanceof z.ZodError
                ? 400
                : 500;
          response.end(
            JSON.stringify({
              message:
                error instanceof HttpError
                  ? error.message
                  : isDomainError(error)
                    ? error.message
                    : response.statusCode === 400
                      ? '数据格式无效，未保存更改'
                      : '服务暂时不可用，请稍后重试',
              ...(isDomainError(error) ? { code: error.code } : {}),
            }),
          );
          if (response.statusCode === 500) console.error('Account API error:', error);
        });
    },
  };
}
