import { toast } from 'sonner';
import { DomainError, DomainErrorCode } from '@/domain';
import { notifyApplicationChanged } from '@/app/application-change';

export interface AccountUser {
  id: string;
  username: string;
}
export interface AccountSession {
  user: AccountUser;
  revision: number;
  legacyChoiceMade: boolean;
}
let current: AccountSession | undefined;
let generation = 0;
const listeners = new Set<() => void>();
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSession = () => current;
const channel =
  typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel('one-day-session');
export function lockSession() {
  current = undefined;
  generation++;
  toast.dismiss();
  for (const listener of listeners) listener();
}
channel?.addEventListener('message', () => {
  lockSession();
  window.location.reload();
});
export function changedSession() {
  channel?.postMessage('changed');
  window.location.reload();
}

export async function apiRequest<T>(
  path: string,
  body?: unknown,
  owner?: string,
): Promise<T> {
  const started = generation;
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(body === undefined
          ? {}
          : { 'Content-Type': 'application/json', 'X-One-Day-Request': '1' }),
        ...(owner ? { 'X-One-Day-User': owner } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('无法连接服务端。操作结果尚未确认，请恢复网络后刷新检查。');
  }
  const result = (await response.json()) as T & {
    message?: string;
    code?: string;
    revision?: number;
  };
  if (started !== generation) throw new Error('账号已切换，请重新登录');
  if (!response.ok) {
    if (response.status === 401 && owner) lockSession();
    if (
      result.code &&
      Object.values(DomainErrorCode).includes(result.code as DomainErrorCode)
    )
      throw new DomainError(result.code as DomainErrorCode, result.message ?? '操作失败');
    throw new Error(result.message ?? '服务暂时不可用，请稍后重试');
  }
  if (
    owner &&
    current &&
    result.revision !== undefined &&
    result.revision > current.revision
  ) {
    current.revision = result.revision;
    notifyApplicationChanged();
  }
  return result;
}
export async function loadSession(): Promise<AccountSession | undefined> {
  const response = await fetch('/api/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  }).catch(() => {
    throw new Error('无法连接账号服务，请检查网络后重试');
  });
  if (response.status === 401) {
    lockSession();
    return undefined;
  }
  if (!response.ok) throw new Error('无法连接账号服务，请稍后重试');
  const session = (await response.json()) as AccountSession;
  current = session;
  for (const listener of listeners) listener();
  return session;
}
