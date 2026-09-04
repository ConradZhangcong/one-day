import { backupDataV1Schema, type BackupDataV1, type TimeZoneId } from '../../domain';
import type {
  BackupRepository,
  KeyValueRepository,
  ListRepository,
  LongTermGoalRepository,
  OccurrenceRecordRepository,
  RecurrenceSeriesRepository,
  ReminderRepository,
  SingleTaskRepository,
  TagRepository,
} from '../../application/repositories';
import { ALL_DAY_REMINDER_TIME_KEY } from '../../application/reminders/reminder-service';
import { APPLICATION_TIME_ZONE_KEY } from '../../application/settings/time-zone-settings';

import type { OneDayDatabase } from './database';
import {
  toListRecord,
  toOccurrenceRecordRecord,
  toRecurrenceSeriesRecord,
  toSingleTaskRecord,
  toTagRecord,
} from './projections';
import { createInboxList } from './system-data';

interface SnapshotRepositories {
  readonly singleTasks: SingleTaskRepository;
  readonly recurrenceSeries: RecurrenceSeriesRepository;
  readonly occurrenceRecords: OccurrenceRecordRepository;
  readonly lists: ListRepository;
  readonly tags: TagRepository;
  readonly reminders: ReminderRepository;
  readonly settings: KeyValueRepository;
  readonly longTermGoals: LongTermGoalRepository;
}

export class DexieBackupRepository implements BackupRepository {
  constructor(
    private readonly db: OneDayDatabase,
    private readonly repositories: SnapshotRepositories,
  ) {}

  readSnapshot(): Promise<BackupDataV1> {
    return this.db.transaction('r', this.db.tables, async () => {
      const [
        singleTasks,
        recurrenceSeries,
        occurrenceRecords,
        lists,
        tags,
        reminders,
        longTermGoals,
        applicationTimeZone,
        allDayReminderTime,
      ] = await Promise.all([
        this.repositories.singleTasks.getAll(),
        this.repositories.recurrenceSeries.getAll(),
        this.repositories.occurrenceRecords.getAll(),
        this.repositories.lists.getAll(),
        this.repositories.tags.getAll(),
        this.repositories.reminders.getAll(),
        this.repositories.longTermGoals.getAll(),
        this.repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
        this.repositories.settings.get(ALL_DAY_REMINDER_TIME_KEY),
      ]);

      return backupDataV1Schema.parse({
        singleTasks,
        recurrenceSeries,
        occurrenceRecords,
        lists,
        tags,
        reminders,
        longTermGoals,
        settings: {
          applicationTimeZone,
          ...(allDayReminderTime === undefined ? {} : { allDayReminderTime }),
        },
      });
    });
  }

  async replaceAll(data: BackupDataV1): Promise<void> {
    const decoded = backupDataV1Schema.parse(data);
    await this.clearTables();

    const settings = [
      {
        key: APPLICATION_TIME_ZONE_KEY,
        value: decoded.settings.applicationTimeZone,
      },
      ...(decoded.settings.allDayReminderTime === undefined
        ? []
        : [
            {
              key: ALL_DAY_REMINDER_TIME_KEY,
              value: decoded.settings.allDayReminderTime,
            },
          ]),
    ];
    await this.db.settings.bulkAdd(settings);
    await this.db.lists.bulkAdd(decoded.lists.map(toListRecord));

    if (decoded.tags.length > 0) {
      await this.db.tags.bulkAdd(decoded.tags.map(toTagRecord));
    }
    if (decoded.longTermGoals.length > 0) {
      await this.db.longTermGoals.bulkAdd(decoded.longTermGoals);
    }
    if (decoded.singleTasks.length > 0) {
      await this.db.singleTasks.bulkAdd(decoded.singleTasks.map(toSingleTaskRecord));
    }
    if (decoded.recurrenceSeries.length > 0) {
      await this.db.recurrenceSeries.bulkAdd(
        decoded.recurrenceSeries.map(toRecurrenceSeriesRecord),
      );
    }
    if (decoded.occurrenceRecords.length > 0) {
      await this.db.occurrenceRecords.bulkAdd(
        decoded.occurrenceRecords.map(toOccurrenceRecordRecord),
      );
    }
    if (decoded.reminders.length > 0) {
      await this.db.reminders.bulkAdd(decoded.reminders);
    }
  }

  async clearAll(applicationTimeZone: TimeZoneId): Promise<void> {
    await this.clearTables();
    await this.db.settings.add({
      key: APPLICATION_TIME_ZONE_KEY,
      value: applicationTimeZone,
    });
    await this.db.lists.add(toListRecord(createInboxList()));
  }

  private async clearTables(): Promise<void> {
    await Promise.all(this.db.tables.map((table) => table.clear()));
  }
}
