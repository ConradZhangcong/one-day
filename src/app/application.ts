import {
  RecoveryService,
  ReminderRuntime,
  ReminderService,
  TimeZoneSettingsService,
  TodoService,
  GoalService,
  CalendarService,
  OccurrenceQueryService,
  RecurrenceService,
  BackupService,
} from '@/application';
import { DexieUnitOfWork, openOneDayDatabase } from '@/infrastructure/db';
import { deliverBrowserReminder } from '@/infrastructure/notifications';

import { notifyApplicationChanged } from './application-change';

export interface ApplicationServices {
  readonly timeZoneSettings: TimeZoneSettingsService;
  readonly todos: TodoService;
  readonly recovery: RecoveryService;
  readonly reminders: ReminderService;
  readonly reminderRuntime: ReminderRuntime;
  readonly goals: GoalService;
  readonly calendar: CalendarService;
  readonly occurrences: OccurrenceQueryService;
  readonly recurrence: RecurrenceService;
  readonly backup: BackupService;
}

let servicesPromise: Promise<ApplicationServices> | undefined;

/** Composition root shared by the React tree for the lifetime of the page. */
export function getApplicationServices(): Promise<ApplicationServices> {
  servicesPromise ??= openOneDayDatabase().then((database) => {
    const unitOfWork = new DexieUnitOfWork(database, notifyApplicationChanged);
    const reminderRuntime = new ReminderRuntime(unitOfWork, {
      deliver: deliverBrowserReminder,
    });
    const todos = new TodoService(unitOfWork, {
      onScheduleChanged: () => void reminderRuntime.reconcile(),
    });
    const recurrence = new RecurrenceService(unitOfWork, {
      onScheduleChanged: () => void reminderRuntime.reconcile(),
    });
    const backup = new BackupService(unitOfWork, {
      onRestored: () => void reminderRuntime.reconcile(),
      onCleared: () => void reminderRuntime.reconcile(),
    });
    return {
      timeZoneSettings: new TimeZoneSettingsService(unitOfWork),
      todos,
      recovery: new RecoveryService(unitOfWork, todos, {}, recurrence),
      reminders: new ReminderService(unitOfWork),
      reminderRuntime,
      goals: new GoalService(unitOfWork),
      calendar: new CalendarService(unitOfWork),
      occurrences: new OccurrenceQueryService(unitOfWork),
      recurrence,
      backup,
    };
  });

  return servicesPromise;
}
