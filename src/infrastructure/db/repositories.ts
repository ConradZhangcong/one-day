import type { Table } from 'dexie';

import {
  occurrenceRecordSchema,
  recurrenceSeriesSchema,
  reminderSchema,
  singleTaskSchema,
  tagSchema,
  taskListSchema,
  type OccurrenceRecord,
  type RecurrenceSeries,
  type Reminder,
  type SingleTask,
  type Tag,
  type TaskList,
  type LongTermGoal,
  longTermGoalSchema,
} from '../../domain';
import type {
  EntityRepository,
  KeyValueEntry,
  KeyValueRepository,
  ListRepository,
  OccurrenceRecordRepository,
  OneDayRepositories,
  RecurrenceSeriesRepository,
  ReminderRepository,
  SingleTaskRepository,
  TagRepository,
  LongTermGoalRepository,
} from '../../application/repositories';

import type { OneDayDatabase } from './database';
import { deleteListAndMoveContentsToInbox } from './list-transactions';
import {
  fromListRecord,
  fromOccurrenceRecordRecord,
  fromRecurrenceSeriesRecord,
  fromSingleTaskRecord,
  fromTagRecord,
  normalizeIndexedText,
  toListRecord,
  toOccurrenceRecordRecord,
  toRecurrenceSeriesRecord,
  toSingleTaskRecord,
  toTagRecord,
} from './projections';
import type {
  ListRecord,
  OccurrenceRecordRecord,
  RecurrenceSeriesRecord,
  SingleTaskRecord,
  TagRecord,
  LongTermGoalRecord,
} from './records';

type RecordEncoder<TEntity, TRecord> = (entity: TEntity) => TRecord;
type RecordDecoder<TRecord, TEntity> = (record: TRecord) => TEntity;

class DexieEntityRepository<
  TEntity,
  TKey extends string,
  TRecord,
> implements EntityRepository<TEntity, TKey> {
  constructor(
    protected readonly table: Table<TRecord, string>,
    private readonly encode: RecordEncoder<TEntity, TRecord>,
    private readonly decode: RecordDecoder<TRecord, TEntity>,
  ) {}

  async get(id: TKey): Promise<TEntity | undefined> {
    const record = await this.table.get(id);
    return record === undefined ? undefined : this.decode(record);
  }

  async getAll(): Promise<TEntity[]> {
    return this.decodeMany(await this.table.toArray());
  }

  async save(entity: TEntity): Promise<void> {
    await this.table.put(this.encode(entity));
  }

  async saveMany(entities: readonly TEntity[]): Promise<void> {
    if (entities.length === 0) {
      return;
    }

    await this.table.bulkPut(entities.map((entity) => this.encode(entity)));
  }

  async remove(id: TKey): Promise<void> {
    await this.table.delete(id);
  }

  protected decodeMany(records: readonly TRecord[]): TEntity[] {
    return records.map((record) => this.decode(record));
  }
}

class DexieLongTermGoalRepository
  extends DexieEntityRepository<LongTermGoal, LongTermGoal['id'], LongTermGoalRecord>
  implements LongTermGoalRepository
{
  constructor(table: Table<LongTermGoalRecord, string>) {
    super(
      table,
      (goal) => goal,
      (record) => longTermGoalSchema.parse(record),
    );
  }

  async findByStatus(status: LongTermGoal['status']): Promise<LongTermGoal[]> {
    return this.decodeMany(await this.table.where('status').equals(status).toArray());
  }
}

class DexieSingleTaskRepository
  extends DexieEntityRepository<SingleTask, SingleTask['id'], SingleTaskRecord>
  implements SingleTaskRepository
{
  constructor(table: Table<SingleTaskRecord, string>) {
    super(table, toSingleTaskRecord, (record) =>
      singleTaskSchema.parse(fromSingleTaskRecord(record)),
    );
  }

  async findByListId(listId: SingleTask['listId']): Promise<SingleTask[]> {
    return (await this.getAll()).filter((task) => task.listId === listId);
  }

  async findByState(state: SingleTask['state']): Promise<SingleTask[]> {
    return this.decodeMany(await this.table.where('state').equals(state).toArray());
  }
}

class DexieRecurrenceSeriesRepository
  extends DexieEntityRepository<
    RecurrenceSeries,
    RecurrenceSeries['id'],
    RecurrenceSeriesRecord
  >
  implements RecurrenceSeriesRepository
{
  constructor(table: Table<RecurrenceSeriesRecord, string>) {
    super(table, toRecurrenceSeriesRecord, (record) =>
      recurrenceSeriesSchema.parse(fromRecurrenceSeriesRecord(record)),
    );
  }

  async findByListId(
    listId: RecurrenceSeries['template']['listId'],
  ): Promise<RecurrenceSeries[]> {
    return (await this.getAll()).filter((series) => series.template.listId === listId);
  }

  async findByStatus(status: RecurrenceSeries['status']): Promise<RecurrenceSeries[]> {
    return this.decodeMany(await this.table.where('status').equals(status).toArray());
  }
}

class DexieOccurrenceRecordRepository
  extends DexieEntityRepository<
    OccurrenceRecord,
    OccurrenceRecord['occurrenceKey'],
    OccurrenceRecordRecord
  >
  implements OccurrenceRecordRepository
{
  constructor(table: Table<OccurrenceRecordRecord, string>) {
    super(table, toOccurrenceRecordRecord, (record) =>
      occurrenceRecordSchema.parse(fromOccurrenceRecordRecord(record)),
    );
  }

  async findBySeriesId(
    seriesId: OccurrenceRecord['seriesId'],
  ): Promise<OccurrenceRecord[]> {
    return this.decodeMany(await this.table.where('seriesId').equals(seriesId).toArray());
  }

  async findBySeriesAndState(
    seriesId: OccurrenceRecord['seriesId'],
    state: OccurrenceRecord['state'],
  ): Promise<OccurrenceRecord[]> {
    return this.decodeMany(
      await this.table.where('[seriesId+state]').equals([seriesId, state]).toArray(),
    );
  }
}

class DexieListRepository
  extends DexieEntityRepository<TaskList, TaskList['id'], ListRecord>
  implements ListRepository
{
  constructor(private readonly db: OneDayDatabase) {
    super(db.lists, toListRecord, (record) =>
      taskListSchema.parse(fromListRecord(record)),
    );
  }

  deleteAndMoveContentsToInbox(listId: TaskList['id']) {
    return deleteListAndMoveContentsToInbox(this.db, listId);
  }

  async listInDisplayOrder(options?: { includeArchived?: boolean }): Promise<TaskList[]> {
    const records = options?.includeArchived
      ? await this.table.orderBy('order').toArray()
      : await this.table.where('archivedValue').equals(0).sortBy('order');

    return this.decodeMany(records);
  }
}

class DexieTagRepository
  extends DexieEntityRepository<Tag, Tag['id'], TagRecord>
  implements TagRepository
{
  constructor(table: Table<TagRecord, string>) {
    super(table, toTagRecord, (record) => tagSchema.parse(fromTagRecord(record)));
  }

  async findByName(name: string): Promise<Tag | undefined> {
    const record = await this.table
      .where('normalizedName')
      .equals(normalizeIndexedText(name))
      .first();

    return record === undefined ? undefined : tagSchema.parse(fromTagRecord(record));
  }
}

class DexieReminderRepository
  extends DexieEntityRepository<Reminder, Reminder['id'], Reminder>
  implements ReminderRepository
{
  constructor(table: Table<Reminder, string>) {
    super(
      table,
      (reminder) => reminder,
      (record) => reminderSchema.parse(record),
    );
  }

  async findByOwner(
    ownerKind: Reminder['ownerKind'],
    ownerId: Reminder['ownerId'],
  ): Promise<Reminder[]> {
    return this.decodeMany(
      await this.table
        .where('[ownerKind+ownerId]')
        .equals([ownerKind, ownerId])
        .toArray(),
    );
  }

  async claimDelivery(reminderId: Reminder['id'], deliveryKey: string): Promise<boolean> {
    const record = await this.table.get(reminderId);
    if (record === undefined) return false;
    const reminder = reminderSchema.parse(record);
    if (reminder.lastDeliveryKey === deliveryKey) return false;
    await this.table.put(
      reminderSchema.parse({ ...reminder, lastDeliveryKey: deliveryKey }),
    );
    return true;
  }
}

class DexieKeyValueRepository implements KeyValueRepository {
  constructor(private readonly table: Table<KeyValueEntry, string>) {}

  async get(key: string): Promise<unknown> {
    const entry = await this.table.get(key);
    return entry?.value;
  }

  getAll(): Promise<KeyValueEntry[]> {
    return this.table.toArray();
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.table.put({ key, value });
  }

  async remove(key: string): Promise<void> {
    await this.table.delete(key);
  }
}

export function createDexieRepositories(db: OneDayDatabase): OneDayRepositories {
  return {
    singleTasks: new DexieSingleTaskRepository(db.singleTasks),
    recurrenceSeries: new DexieRecurrenceSeriesRepository(db.recurrenceSeries),
    occurrenceRecords: new DexieOccurrenceRecordRepository(db.occurrenceRecords),
    lists: new DexieListRepository(db),
    tags: new DexieTagRepository(db.tags),
    reminders: new DexieReminderRepository(db.reminders),
    settings: new DexieKeyValueRepository(db.settings),
    meta: new DexieKeyValueRepository(db.meta),
    longTermGoals: new DexieLongTermGoalRepository(db.longTermGoals),
  };
}
