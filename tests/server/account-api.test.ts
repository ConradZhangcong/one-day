// @vitest-environment node
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountApi } from '../../server/api';

const directory = mkdtempSync(join(tmpdir(), 'one-day-auth-'));
let api: ReturnType<typeof createAccountApi>;
let server: Server;
let origin: string;
let clock = Date.now();
interface Client {
  cookie: string;
  user: string;
}
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
interface Body {
  user?: { id: string; username: string };
  result?: any;
  revision?: number;
  message?: string;
}
// Response payloads intentionally inspected as JSON across the HTTP boundary.

async function request(
  path: string,
  body?: unknown,
  client?: Client,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-One-Day-Request': '1',
      ...(client ? { Cookie: client.cookie, 'X-One-Day-User': client.user } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Body,
    cookie: response.headers.get('set-cookie'),
  };
}
async function register(username: string): Promise<Client> {
  const response = await request('register', {
    username,
    password: 'correct horse battery',
    timeZone: 'Asia/Shanghai',
  });
  expect(response.status).toBe(200);
  expect(response.cookie).toContain('HttpOnly');
  expect(response.cookie).toContain('SameSite=Strict');
  return { user: response.body.user!.id, cookie: response.cookie!.split(';')[0]! };
}
const rpc = (client: Client, service: string, method: string, ...args: unknown[]) =>
  request('rpc', { service, method, args }, client);
const draft = (title: string) => ({
  title,
  notes: '',
  listId: 'system:inbox',
  priority: 'none',
  tagNames: [],
  plannedAt: { kind: 'none' },
  deadlineAt: { kind: 'none' },
});
beforeAll(async () => {
  api = createAccountApi({
    databasePath: join(directory, 'db.sqlite'),
    now: () => clock,
  });
  server = createServer(api.handle);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  api.close();
  rmSync(directory, { recursive: true });
});

describe('account authentication and ownership', () => {
  it('requires login, rejects foreign origins, private methods and forged owners', async () => {
    expect((await request('session')).status).toBe(401);
    expect(
      (
        await request(
          'register',
          { username: 'abc', password: 'longpassword' },
          undefined,
          { Origin: 'https://evil.example' },
        )
      ).status,
    ).toBe(403);
    const alice = await register('alice');
    const bob = await register('bob');
    expect((await rpc(alice, 'todos', 'constructor')).status).toBe(404);
    expect((await rpc(alice, '__proto__', 'toString')).status).toBe(404);
    expect(
      (
        await request(
          'rpc',
          { service: 'todos', method: 'snapshot', args: [] },
          { ...alice, user: bob.user },
        )
      ).status,
    ).toBe(401);
    expect(
      (await request('login', { username: 'alice', password: 'wrong_password' })).status,
    ).toBe(401);
  });
  it('keeps tasks, lists, backup and destructive operations scoped to their account', async () => {
    const a = await register('owner_a');
    const b = await register('owner_b');
    const created = await rpc(a, 'todos', 'createTask', draft('Only A'));
    expect(created.status).toBe(200);
    const id = created.body.result.id;
    expect((await rpc(b, 'todos', 'snapshot')).body.result.tasks).toEqual([]);
    expect((await rpc(b, 'todos', 'updateTask', id, draft('Stolen'))).status).toBe(400);
    expect((await rpc(b, 'todos', 'setTaskState', id, 'completed')).status).toBe(400);
    expect((await rpc(b, 'todos', 'deleteTask', id)).status).toBe(200);
    expect((await rpc(b, 'backup', 'createExport')).body.result.data.singleTasks).toEqual(
      [],
    );
    await rpc(b, 'backup', 'clearLocalData');
    expect((await rpc(a, 'todos', 'snapshot')).body.result.tasks[0].title).toBe('Only A');
    const device = await request('login', {
      username: 'owner_a',
      password: 'correct horse battery',
    });
    const second = { user: a.user, cookie: device.cookie!.split(';')[0]! };
    expect((await rpc(second, 'todos', 'snapshot')).body.result.tasks[0].id).toBe(id);
    await Promise.all([
      rpc(a, 'todos', 'createTask', draft('first')),
      rpc(second, 'todos', 'createTask', draft('second')),
    ]);
    expect((await rpc(a, 'todos', 'snapshot')).body.result.tasks).toHaveLength(3);
    expect((await request('logout', {}, a)).status).toBe(200);
    expect((await rpc(a, 'todos', 'snapshot')).status).toBe(401);
    expect((await rpc(second, 'todos', 'snapshot')).status).toBe(200);
  });
  it('imports legacy data only on explicit choice into an empty account, once', async () => {
    const source = await register('legacy_source');
    const target = await register('legacy_target');
    await rpc(source, 'todos', 'createTask', draft('Legacy task'));
    const backup = (await rpc(source, 'backup', 'createExport')).body.result;
    expect((await rpc(target, 'todos', 'snapshot')).body.result.tasks).toEqual([]);
    expect((await request('legacy', { backup }, target)).status).toBe(200);
    expect((await rpc(target, 'todos', 'snapshot')).body.result.tasks[0].title).toBe(
      'Legacy task',
    );
    expect((await request('legacy', { backup }, target)).status).toBe(409);
    const occupied = await register('occupied');
    await rpc(occupied, 'todos', 'createTask', draft('Keep me'));
    expect((await request('legacy', { backup }, occupied)).status).toBe(409);
    expect((await rpc(occupied, 'todos', 'snapshot')).body.result.tasks[0].title).toBe(
      'Keep me',
    );
  });
  it('expires sessions and does not store passwords or session cookies in plaintext', async () => {
    const user = await register('expired');
    clock += 8 * 24 * 60 * 60 * 1000;
    expect((await request('session', undefined, user)).status).toBe(401);
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(directory, 'db.sqlite'));
    const saved = db
      .prepare('SELECT password_hash,salt FROM users WHERE id=?')
      .get(user.user)!;
    expect(saved.password_hash).not.toBe('correct horse battery');
    expect(String(saved.salt)).toHaveLength(32);
    expect(
      db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get(user.user)!
        .token_hash,
    ).not.toBe(user.cookie.split('=')[1]);
    db.close();
  });
});
