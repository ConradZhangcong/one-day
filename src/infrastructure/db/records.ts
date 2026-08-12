import type {
  OccurrenceRecord,
  RecurrenceSeries,
  Reminder,
  SingleTask,
  Tag,
  TaskList,
} from '../../domain';

import type { KeyValueEntry } from '../../application/repositories';

/**
 * IndexedDB cannot index nested discriminated unions directly. These records
 * keep the domain payload intact and add small, rebuildable index projections.
 */
export type SingleTaskRecord = SingleTask & {
  plannedLocalDate: string | undefined;
  deadlineLocalDate: string | undefined;
  normalizedTitle: string;
};

export type RecurrenceSeriesRecord = RecurrenceSeries & {
  listId: RecurrenceSeries['template']['listId'];
  tagIds: RecurrenceSeries['template']['tagIds'];
  anchorLocalDate: string;
};

export type OccurrenceRecordRecord = OccurrenceRecord & {
  originalLocalDate: string;
};

export type ListRecord = TaskList & {
  archivedValue: 0 | 1;
};

export type TagRecord = Tag & {
  normalizedName: string;
};

export type ReminderRecord = Reminder;

export type SettingRecord = KeyValueEntry;
export type MetaRecord = KeyValueEntry;
