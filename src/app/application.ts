import {
  AccountUnitOfWork,
  emptyAccountData,
} from '@/infrastructure/account/unit-of-work';
import {
  createServices,
  accountMethods,
  type AccountServices,
} from '@/application/services';
import { decodeTimeZoneId } from '@/domain';
import type { ReminderDelivery } from '@/application';
import { deliverBrowserReminder } from '@/infrastructure/notifications';
import { apiRequest, getSession } from '@/features/auth/session';

export type ApplicationServices = AccountServices & {
  reminderRuntime: {
    start(): void;
    stop(): void;
    reconcile(): Promise<void>;
    applicationTimeZoneChanged(): Promise<void>;
  };
};
let services: ApplicationServices | undefined;
let servicesOwner: string | undefined;

/** HTTP services are bound to an authenticated owner; the server checks that owner on every call. */
export function getApplicationServices(): Promise<ApplicationServices> {
  const owner = getSession()?.user.id;
  if (!owner) return Promise.reject(new Error('请先登录'));
  if (services && owner === servicesOwner) return Promise.resolve(services);
  services?.reminderRuntime.stop();
  // Only synchronous preview/backup validation runs here. Account reads/writes all use the API.
  const pure = createServices(
    new AccountUnitOfWork(emptyAccountData(decodeTimeZoneId('UTC'))),
  );
  const remote = {} as AccountServices;
  for (const [name, methods] of Object.entries(accountMethods)) {
    const entries = Object.fromEntries(
      methods.map((method) => [
        method,
        async (...args: unknown[]) => {
          if (getSession()?.user.id !== owner) throw new Error('账号已切换，请重新登录');
          const response = await apiRequest<{ result: unknown }>(
            'rpc',
            { service: name, method, args },
            owner,
          );
          return response.result;
        },
      ]),
    );
    Object.assign(remote, { [name]: entries });
  }
  remote.recurrence.preview = pure.recurrence.preview.bind(pure.recurrence);
  remote.backup.inspect = pure.backup.inspect.bind(pure.backup);
  let timer: number | undefined;
  let pending: Promise<void> | undefined;
  let active = false;
  const reconcile = (): Promise<void> => {
    if (getSession()?.user.id !== owner || document.visibilityState !== 'visible')
      return Promise.resolve();
    pending ??= apiRequest<{ deliveries: ReminderDelivery[] }>(
      'reminders/poll',
      {},
      owner,
    )
      .then(({ deliveries }) => {
        if (!active || getSession()?.user.id !== owner) return;
        for (const delivery of deliveries) deliverBrowserReminder(delivery);
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
  const wake = () => {
    void reconcile().catch(() => undefined);
  };
  const reminderRuntime = {
    start() {
      if (active) return;
      active = true;
      wake();
      timer = window.setInterval(wake, 15000);
      window.addEventListener('focus', wake);
    },
    stop() {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener('focus', wake);
    },
    reconcile,
    applicationTimeZoneChanged: reconcile,
  };
  servicesOwner = owner;
  services = { ...remote, reminderRuntime };
  return Promise.resolve(services);
}
