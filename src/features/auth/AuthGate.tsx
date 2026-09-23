import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type FormEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import type { OneDayBackupV1 } from '@/domain';
import {
  apiRequest,
  changedSession,
  getSession,
  loadSession,
  subscribeSession,
} from './session';
import { readLegacyBackup } from './legacy-data';
import logoUrl from '../../../logo/concentric-ring-master-metal.svg';

export function LoginForm() {
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const validate = (name: 'username' | 'password', value: string) => {
    if (!value.trim() && name === 'username') return '请输入账号';
    if (!value) return '请输入密码';
    if (name === 'username')
      return /^[a-zA-Z0-9_]{3,32}$/.test(value.trim())
        ? ''
        : '账号需为 3–32 位字母、数字或下划线';
    return value.length >= 10 && value.length <= 128 ? '' : '密码需为 10–128 位';
  };
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = data.get('username');
    const password = data.get('password');
    const errors = {
      username: validate('username', typeof username === 'string' ? username : ''),
      password: validate('password', typeof password === 'string' ? password : ''),
    };
    setFieldErrors(errors);
    setError('');
    if (errors.username || errors.password) {
      const name = errors.username ? 'username' : 'password';
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await apiRequest(register ? 'register' : 'login', {
        username: data.get('username'),
        password: data.get('password'),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      changedSession();
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败，请重试');
      setBusy(false);
    }
  };
  return (
    <section className="auth-card">
      <img src={logoUrl} alt="One Day" className="size-12" />
      <p className="text-sm text-muted-foreground">ONE DAY · 每一天，井然有序</p>
      <h1 className="text-2xl font-semibold">{register ? '创建你的账号' : '欢迎回来'}</h1>
      <p className="text-sm text-muted-foreground">
        登录后，待办与计划随账号保存，在不同设备继续使用。
      </p>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Field data-invalid={!!fieldErrors.username}>
          <FieldLabel htmlFor="auth-username">账号</FieldLabel>
          <Input
            id="auth-username"
            name="username"
            aria-invalid={!!fieldErrors.username}
            aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
            onBlur={(event) =>
              setFieldErrors((errors) => ({
                ...errors,
                username: validate('username', event.target.value),
              }))
            }
            onChange={(event) => {
              const value = event.target.value;
              setError('');
              setFieldErrors((errors) => ({
                ...errors,
                username: errors.username ? validate('username', value) : '',
              }));
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_]{3,32}"
            placeholder="3–32 位字母、数字或下划线"
            disabled={busy}
          />
          <FieldError id="auth-username-error">{fieldErrors.username}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.password}>
          <FieldLabel htmlFor="auth-password">密码</FieldLabel>
          <Input
            id="auth-password"
            name="password"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
            onBlur={(event) =>
              setFieldErrors((errors) => ({
                ...errors,
                password: validate('password', event.target.value),
              }))
            }
            onChange={(event) => {
              const value = event.target.value;
              setError('');
              setFieldErrors((errors) => ({
                ...errors,
                password: errors.password ? validate('password', value) : '',
              }));
            }}
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={10}
            maxLength={128}
            placeholder="至少 10 位"
            disabled={busy}
          />
          <FieldError id="auth-password-error">{fieldErrors.password}</FieldError>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? '正在处理…' : register ? '注册并登录' : '登录'}
        </Button>
      </form>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setFieldErrors({ username: '', password: '' });
          setError('');
        }}
      >
        {register ? '已有账号？返回登录' : '还没有账号？创建账号'}
      </Button>
    </section>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [legacy, setLegacy] = useState<OneDayBackupV1>();
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [legacyIssue, setLegacyIssue] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSession()
      .then(async (session) => {
        if (session && !session.legacyChoiceMade) {
          const backup = await readLegacyBackup().catch(() => {
            if (active) setLegacyIssue(true);
            return undefined;
          });
          if (active) setLegacy(backup);
        }
      })
      .catch((error: unknown) => {
        if (active)
          setError(error instanceof Error ? error.message : '无法读取账号或旧数据');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      void apiRequest('session', undefined, session.user.id)
        .then(() => setConnectionError(false))
        .catch(() => setConnectionError(true));
    };
    const timer = window.setInterval(check, 15000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [session]);
  const choose = async (importData: boolean) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('legacy', importData ? { backup: legacy } : {}, session.user.id);
      setLegacy(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : '导入失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <main className="auth-screen">
        <p role="status">正在连接你的账号…</p>
      </main>
    );
  if (error && !legacy)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>暂时无法打开 One Day</h1>
          <p role="alert">{error}</p>
          <Button onClick={() => window.location.reload()}>重新连接</Button>
          <p className="text-sm">原有数据未删除。</p>
        </section>
      </main>
    );
  if (!session)
    return (
      <main className="auth-screen">
        <LoginForm />
      </main>
    );
  if (legacyIssue)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>暂时无法读取旧版数据</h1>
          <p>原始浏览器数据已保留。你可以稍后在设置中重试导出，不影响使用当前账号。</p>
          <Button onClick={() => setLegacyIssue(false)}>暂不处理，进入账号</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            重新读取
          </Button>
        </section>
      </main>
    );
  if (legacy)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1 className="text-xl font-semibold">导入这台设备的旧数据？</h1>
          <p>
            检测到 {legacy.data.singleTasks.length} 个待办、
            {legacy.data.recurrenceSeries.length} 个重复系列。
          </p>
          <p>
            导入后，这些内容将保存到账号 <strong>{session.user.username}</strong>
            ，可在其他设备访问。原有浏览器数据会保留。
          </p>
          <p className="text-sm text-muted-foreground">
            仅支持导入到空账号；已有内容的账号可在设置中通过备份恢复。
          </p>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy} onClick={() => void choose(true)}>
            {busy ? '正在处理…' : '导入当前账号'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void choose(false)}>
            不导入，继续使用
          </Button>
          <AccountButton />
        </section>
      </main>
    );
  return (
    <>
      {connectionError && (
        <div role="status" className="account-connection">
          暂时无法同步，请检查网络。操作后请等待保存结果，避免重复提交。
        </div>
      )}
      {children}
    </>
  );
}

export function AccountButton() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session) return null;
  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest('logout', {}, session.user.id);
      changedSession();
    } catch (error) {
      setError(error instanceof Error ? error.message : '退出失败，请重试');
      setBusy(false);
    }
  };
  return (
    <div className="account-controls">
      <span title={session.user.username}>{session.user.username}</span>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void logout()}>
        {busy ? '正在退出…' : '退出登录'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
