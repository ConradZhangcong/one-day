import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export interface ServerConfig {
  origin: string;
  databasePath: string;
  host: string;
  port: number;
  adminPassword?: string;
}

export function loadServerConfig(
  path = resolve(process.env.ONE_DAY_CONFIG_FILE ?? '.env'),
): ServerConfig {
  let values: NodeJS.Dict<string>;
  try {
    values = parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(`缺少配置文件 ${path}。请复制 .env.example 为 .env 并填写配置。`, {
        cause: error,
      });
    throw error;
  }

  const required = (name: string) => {
    const value = values[name]?.trim();
    if (!value) throw new Error(`.env 缺少必填配置 ${name}。`);
    return value;
  };
  const origin = required('ONE_DAY_ORIGIN');
  const databasePath = resolve(required('ONE_DAY_DATABASE'));
  const host = required('HOST');
  const port = Number(required('PORT'));
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('.env 中的 ONE_DAY_ORIGIN 必须是完整的访问来源。');
  }
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol))
    throw new Error('.env 中的 ONE_DAY_ORIGIN 必须只包含协议、域名和可选端口。');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('非本机部署的 ONE_DAY_ORIGIN 必须使用 HTTPS。');

  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('.env 中的 PORT 必须是 1 到 65535 之间的整数。');

  return {
    origin,
    databasePath,
    host,
    port,
    ...(values.ONE_DAY_ADMIN_PASSWORD?.trim()
      ? { adminPassword: values.ONE_DAY_ADMIN_PASSWORD }
      : {}),
  };
}
