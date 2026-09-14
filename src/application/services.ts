import {
  BackupService,
  CalendarService,
  GoalService,
  OccurrenceQueryService,
  RecoveryService,
  RecurrenceService,
  ReminderService,
  TimeZoneSettingsService,
  TodoService,
  type UnitOfWork,
} from './index';

export function createServices(
  unitOfWork: UnitOfWork,
  detectTimeZone: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const todos = new TodoService(unitOfWork);
  const recurrence = new RecurrenceService(unitOfWork);
  return {
    todos,
    recurrence,
    recovery: new RecoveryService(unitOfWork, todos, {}, recurrence),
    reminders: new ReminderService(unitOfWork),
    timeZoneSettings: new TimeZoneSettingsService(unitOfWork),
    goals: new GoalService(unitOfWork),
    calendar: new CalendarService(unitOfWork),
    occurrences: new OccurrenceQueryService(unitOfWork),
    backup: new BackupService(unitOfWork, { detectTimeZone }),
  };
}

/** Explicit allowlist: prototype/private service methods must never become HTTP endpoints. */
export const accountMethods = {
  todos: [
    'snapshot',
    'createList',
    'updateList',
    'reorderList',
    'deleteList',
    'createTask',
    'updateTask',
    'setTaskState',
    'undoTaskCompletion',
    'deleteTask',
    'rescheduleTask',
  ],
  recurrence: [
    'createSeries',
    'completeOccurrence',
    'skipOccurrence',
    'rescheduleOccurrence',
    'pauseSeries',
    'resumeSeries',
    'stopSeries',
    'updateSeries',
  ],
  recovery: ['snapshot', 'review', 'completeTask', 'skipTask', 'rescheduleTask'],
  reminders: [
    'list',
    'create',
    'update',
    'remove',
    'snooze',
    'snoozeForMinutes',
    'getAllDayDefaultTime',
    'setAllDayDefaultTime',
  ],
  timeZoneSettings: ['inspectDeviceTimeZone', 'confirmDeviceTimeZone'],
  goals: ['snapshot', 'create', 'update'],
  calendar: ['query'],
  occurrences: ['history', 'query'],
  backup: ['createExport', 'restore', 'clearLocalData'],
} as const;

export type ServiceInstances = ReturnType<typeof createServices>;
export type AccountServices = {
  [K in keyof ServiceInstances]: Pick<ServiceInstances[K], keyof ServiceInstances[K]>;
};
