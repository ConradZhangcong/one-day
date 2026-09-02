import { z } from 'zod';

import { DomainError, DomainErrorCode } from '../errors';
import { longTermGoalSchema } from '../goal';
import { occurrenceRecordSchema, recurrenceSeriesSchema } from '../recurrence';
import { parseOccurrenceKey } from '../recurrence/occurrence-key';
import { reminderSchema } from '../reminder';
import { instantSchema, localTimeSchema, timeZoneIdSchema } from '../schedule';
import {
  normalizeIndexedText,
  singleTaskSchema,
  SYSTEM_INBOX_ID,
  tagSchema,
  taskListSchema,
} from '../task';

export const ONE_DAY_BACKUP_FORMAT = 'one-day-backup';
export const ONE_DAY_BACKUP_VERSION = 1;

export const backupSettingsV1Schema = z
  .object({
    applicationTimeZone: timeZoneIdSchema,
    allDayReminderTime: localTimeSchema.optional(),
  })
  .strict();

export const backupDataV1Schema = z
  .object({
    singleTasks: z.array(singleTaskSchema),
    recurrenceSeries: z.array(recurrenceSeriesSchema),
    occurrenceRecords: z.array(occurrenceRecordSchema),
    lists: z.array(taskListSchema),
    tags: z.array(tagSchema),
    reminders: z.array(reminderSchema),
    longTermGoals: z.array(longTermGoalSchema),
    settings: backupSettingsV1Schema,
  })
  .strict();

export const oneDayBackupV1Schema = z
  .object({
    format: z.literal(ONE_DAY_BACKUP_FORMAT),
    version: z.literal(ONE_DAY_BACKUP_VERSION),
    exportedAt: instantSchema,
    timeZone: timeZoneIdSchema,
    data: backupDataV1Schema,
  })
  .strict();

export type BackupSettingsV1 = z.infer<typeof backupSettingsV1Schema>;
export type BackupDataV1 = z.infer<typeof backupDataV1Schema>;
export type OneDayBackupV1 = z.infer<typeof oneDayBackupV1Schema>;

function invalidData(reason: string): never {
  throw new DomainError(
    DomainErrorCode.BACKUP_INVALID_DATA,
    'Backup data is inconsistent.',
    { reason },
  );
}

function uniqueValues(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    invalidData(`Duplicate ${label}.`);
  }
}

function requireReferences(
  values: readonly string[],
  available: ReadonlySet<string>,
  label: string,
): void {
  if (values.some((value) => !available.has(value))) {
    invalidData(`Missing ${label} reference.`);
  }
}

export function validateBackupGraph(backup: OneDayBackupV1): OneDayBackupV1 {
  const { data } = backup;
  if (backup.timeZone !== data.settings.applicationTimeZone) {
    invalidData('Backup time zones do not match.');
  }

  uniqueValues(
    data.singleTasks.map((item) => item.id),
    'task id',
  );
  uniqueValues(
    data.recurrenceSeries.map((item) => item.id),
    'series id',
  );
  uniqueValues(
    data.occurrenceRecords.map((item) => item.occurrenceKey),
    'occurrence key',
  );
  uniqueValues(
    data.lists.map((item) => item.id),
    'list id',
  );
  uniqueValues(
    data.tags.map((item) => item.id),
    'tag id',
  );
  uniqueValues(
    data.tags.map((item) => normalizeIndexedText(item.name)),
    'normalized tag name',
  );
  uniqueValues(
    data.reminders.map((item) => item.id),
    'reminder id',
  );
  uniqueValues(
    data.longTermGoals.map((item) => item.id),
    'goal id',
  );

  const inboxes = data.lists.filter((list) => list.id === SYSTEM_INBOX_ID);
  const inbox = inboxes[0];
  if (
    inboxes.length !== 1 ||
    inbox?.name !== '收件箱' ||
    inbox.order !== 0 ||
    inbox.archived ||
    !inbox.isSystem
  ) {
    invalidData('The system inbox is missing or non-canonical.');
  }
  if (data.lists.some((list) => list.isSystem && list.id !== SYSTEM_INBOX_ID)) {
    invalidData('An unknown system list is present.');
  }

  const listIds = new Set(data.lists.map((item) => item.id));
  const tagIds = new Set(data.tags.map((item) => item.id));
  const goalIds = new Set(data.longTermGoals.map((item) => item.id));
  for (const task of data.singleTasks) {
    requireReferences([task.listId], listIds, 'task list');
    requireReferences(task.tagIds, tagIds, 'task tag');
    if (task.goalId !== undefined) {
      requireReferences([task.goalId], goalIds, 'task goal');
    }
  }
  for (const series of data.recurrenceSeries) {
    requireReferences([series.template.listId], listIds, 'series list');
    requireReferences(series.template.tagIds, tagIds, 'series tag');
    if (series.template.goalId !== undefined) {
      requireReferences([series.template.goalId], goalIds, 'series goal');
    }
  }

  const seriesById = new Map(data.recurrenceSeries.map((item) => [item.id, item]));
  const occurrencesBySeries = new Map<string, typeof data.occurrenceRecords>();
  for (const occurrence of data.occurrenceRecords) {
    const series = seriesById.get(occurrence.seriesId);
    if (series === undefined) {
      invalidData('An occurrence references a missing series.');
    }
    const identity = parseOccurrenceKey(occurrence.occurrenceKey);
    if (identity.revision > series.revision) {
      invalidData('An occurrence belongs to a future series revision.');
    }
    const current = occurrencesBySeries.get(occurrence.seriesId) ?? [];
    current.push(occurrence);
    occurrencesBySeries.set(occurrence.seriesId, current);
  }

  for (const series of data.recurrenceSeries) {
    const occurrences = occurrencesBySeries.get(series.id) ?? [];
    const pending = occurrences.filter((item) => item.state === 'pending');
    if (series.status === 'active' || series.status === 'paused') {
      if (
        pending.length !== 1 ||
        pending[0]?.occurrenceKey !== series.activeOccurrenceKey
      ) {
        invalidData('A live series does not own exactly its active occurrence.');
      }
    } else if (pending.length !== 0) {
      invalidData('A terminal series owns a pending occurrence.');
    }
  }

  const taskById = new Map(data.singleTasks.map((item) => [item.id, item]));
  for (const reminder of data.reminders) {
    const owner =
      reminder.ownerKind === 'task'
        ? taskById.get(reminder.ownerId)
        : seriesById.get(reminder.ownerId)?.template;
    if (owner === undefined) {
      invalidData('A reminder references a missing owner.');
    }
    const target = reminder.target === 'planned' ? owner.plannedAt : owner.deadlineAt;
    if (target.kind === 'none') {
      invalidData('A reminder references a missing schedule target.');
    }
  }

  return backup;
}

export function decodeOneDayBackup(input: unknown): OneDayBackupV1 {
  const envelope = z
    .object({ format: z.unknown(), version: z.unknown() })
    .passthrough()
    .safeParse(input);
  if (!envelope.success || envelope.data.format !== ONE_DAY_BACKUP_FORMAT) {
    throw new DomainError(
      DomainErrorCode.BACKUP_INVALID_FORMAT,
      'This is not a One Day backup.',
    );
  }
  if (envelope.data.version !== ONE_DAY_BACKUP_VERSION) {
    throw new DomainError(
      DomainErrorCode.BACKUP_UNSUPPORTED_VERSION,
      'This backup version is not supported.',
      { version: envelope.data.version },
    );
  }

  const parsed = oneDayBackupV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      DomainErrorCode.BACKUP_INVALID_DATA,
      'Backup data does not match the version 1 contract.',
    );
  }
  return validateBackupGraph(parsed.data);
}
