import Dexie, { type DexieOptions, type Table } from 'dexie';

import type {
  ListRecord,
  MetaRecord,
  OccurrenceRecordRecord,
  RecurrenceSeriesRecord,
  ReminderRecord,
  SettingRecord,
  SingleTaskRecord,
  TagRecord,
} from './records';
import { DATABASE_NAME, DATABASE_VERSION, V1_STORES } from './schema';
import { ensureInbox } from './system-data';

export class OneDayDatabase extends Dexie {
  singleTasks!: Table<SingleTaskRecord, string>;
  recurrenceSeries!: Table<RecurrenceSeriesRecord, string>;
  occurrenceRecords!: Table<OccurrenceRecordRecord, string>;
  lists!: Table<ListRecord, string>;
  tags!: Table<TagRecord, string>;
  reminders!: Table<ReminderRecord, string>;
  settings!: Table<SettingRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = DATABASE_NAME, options?: DexieOptions) {
    super(name, options);
    this.version(DATABASE_VERSION).stores(V1_STORES);
  }
}

/** Opens the current schema and establishes required system data. */
export async function openOneDayDatabase(name = DATABASE_NAME): Promise<OneDayDatabase> {
  const db = new OneDayDatabase(name);

  try {
    await db.open();
    await ensureInbox(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
