import {
  RecoveryService,
  ReminderRuntime,
  ReminderService,
  TimeZoneSettingsService,
  TodoService,
} from '@/application';
import { DexieUnitOfWork, openOneDayDatabase } from '@/infrastructure/db';
import { deliverBrowserReminder } from '@/infrastructure/notifications';

export interface ApplicationServices {
  readonly timeZoneSettings: TimeZoneSettingsService;
  readonly todos: TodoService;
  readonly recovery: RecoveryService;
  readonly reminders: ReminderService;
  readonly reminderRuntime: ReminderRuntime;
}

let servicesPromise: Promise<ApplicationServices> | undefined;

/** Composition root shared by the React tree for the lifetime of the page. */
export function getApplicationServices(): Promise<ApplicationServices> {
  servicesPromise ??= openOneDayDatabase().then((database) => {
    const unitOfWork = new DexieUnitOfWork(database);
    const reminderRuntime = new ReminderRuntime(unitOfWork, {
      deliver: deliverBrowserReminder,
    });
    const todos = new TodoService(unitOfWork, {
      onScheduleChanged: () => void reminderRuntime.reconcile(),
    });
    return {
      timeZoneSettings: new TimeZoneSettingsService(unitOfWork),
      todos,
      recovery: new RecoveryService(unitOfWork, todos),
      reminders: new ReminderService(unitOfWork),
      reminderRuntime,
    };
  });

  return servicesPromise;
}
