import {
  backupDataV1Schema,
  SYSTEM_INBOX_ID,
  DomainError,
  DomainErrorCode,
  type BackupDataV1,
  type TimeZoneId,
} from '../../domain';
import type {
  EntityRepository,
  KeyValueRepository,
  OneDayRepositories,
  UnitOfWork,
} from '../../application';

export function emptyAccountData(timeZone: TimeZoneId): BackupDataV1 {
  return backupDataV1Schema.parse({
    singleTasks: [],
    recurrenceSeries: [],
    occurrenceRecords: [],
    tags: [],
    reminders: [],
    longTermGoals: [],
    lists: [
      { id: SYSTEM_INBOX_ID, name: '收件箱', order: 0, archived: false, isSystem: true },
    ],
    settings: { applicationTimeZone: timeZone },
  });
}

/** Request-scoped domain repositories. Only the server persists the completed request. */
export class AccountUnitOfWork implements UnitOfWork {
  data: BackupDataV1;
  readonly repositories: OneDayRepositories;
  constructor(data: BackupDataV1) {
    this.data = structuredClone(data);
    const entity = <T, K extends string>(
      read: () => T[],
      key: (row: T) => K,
    ): EntityRepository<T, K> => ({
      get: (id) =>
        Promise.resolve(structuredClone(read().find((row) => key(row) === id))),
      getAll: () => Promise.resolve(structuredClone(read())),
      save: (row) => {
        const rows = read();
        const index = rows.findIndex((item) => key(item) === key(row));
        if (index < 0) rows.push(structuredClone(row));
        else rows[index] = structuredClone(row);
        return Promise.resolve();
      },
      saveMany: async (rows) => {
        for (const row of rows) await entity(read, key).save(row);
      },
      remove: (id) => {
        const rows = read();
        const index = rows.findIndex((row) => key(row) === id);
        if (index >= 0) rows.splice(index, 1);
        return Promise.resolve();
      },
    });
    const tasks = entity(
      () => this.data.singleTasks,
      (row) => row.id,
    );
    const series = entity(
      () => this.data.recurrenceSeries,
      (row) => row.id,
    );
    const occurrences = entity(
      () => this.data.occurrenceRecords,
      (row) => row.occurrenceKey,
    );
    const lists = entity(
      () => this.data.lists,
      (row) => row.id,
    );
    const tags = entity(
      () => this.data.tags,
      (row) => row.id,
    );
    const reminders = entity(
      () => this.data.reminders,
      (row) => row.id,
    );
    const goals = entity(
      () => this.data.longTermGoals,
      (row) => row.id,
    );
    const normalize = (value: string) =>
      value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
    const values = (read: () => Record<string, unknown>): KeyValueRepository => ({
      get: (key) => Promise.resolve(structuredClone(read()[key])),
      getAll: () =>
        Promise.resolve(
          Object.entries(read()).map(([key, value]) => ({
            key,
            value: structuredClone(value),
          })),
        ),
      set: (key, value) => {
        read()[key] = structuredClone(value);
        return Promise.resolve();
      },
      remove: (key) => {
        delete read()[key];
        return Promise.resolve();
      },
    });
    const meta: Record<string, unknown> = {};
    this.repositories = {
      singleTasks: {
        ...tasks,
        findByListId: async (id) =>
          (await tasks.getAll()).filter((row) => row.listId === id),
        findByState: async (state) =>
          (await tasks.getAll()).filter((row) => row.state === state),
      },
      recurrenceSeries: {
        ...series,
        findByListId: async (id) =>
          (await series.getAll()).filter((row) => row.template.listId === id),
        findByStatus: async (status) =>
          (await series.getAll()).filter((row) => row.status === status),
      },
      occurrenceRecords: {
        ...occurrences,
        findBySeriesId: async (id) =>
          (await occurrences.getAll()).filter((row) => row.seriesId === id),
        findBySeriesAndState: async (id, state) =>
          (await occurrences.getAll()).filter(
            (row) => row.seriesId === id && row.state === state,
          ),
      },
      lists: {
        ...lists,
        listInDisplayOrder: async (options) =>
          (await lists.getAll())
            .filter((row) => options?.includeArchived === true || !row.archived)
            .sort((a, b) => a.order - b.order),
        deleteAndMoveContentsToInbox: async (id) => {
          if (id === SYSTEM_INBOX_ID)
            throw new DomainError(
              DomainErrorCode.SYSTEM_LIST_IMMUTABLE,
              '不能删除收件箱',
            );
          if (!(await lists.get(id)))
            throw new DomainError(DomainErrorCode.LIST_NOT_FOUND, '清单不存在');
          const taskRows = this.data.singleTasks.filter((row) => row.listId === id);
          const seriesRows = this.data.recurrenceSeries.filter(
            (row) => row.template.listId === id,
          );
          await tasks.saveMany(
            taskRows.map((row) => ({ ...row, listId: SYSTEM_INBOX_ID })),
          );
          await series.saveMany(
            seriesRows.map((row) => ({
              ...row,
              template: { ...row.template, listId: SYSTEM_INBOX_ID },
            })),
          );
          await lists.remove(id);
          return {
            movedSingleTaskCount: taskRows.length,
            movedRecurrenceSeriesCount: seriesRows.length,
          };
        },
      },
      tags: {
        ...tags,
        findByName: async (name) =>
          (await tags.getAll()).find((row) => normalize(row.name) === normalize(name)),
      },
      reminders: {
        ...reminders,
        findByOwner: async (kind, id) =>
          (await reminders.getAll()).filter(
            (row) => row.ownerKind === kind && row.ownerId === id,
          ),
        claimDelivery: async (id, key) => {
          const reminder = await reminders.get(id);
          if (!reminder || reminder.lastDeliveryKey === key) return false;
          await reminders.save({ ...reminder, lastDeliveryKey: key });
          return true;
        },
      },
      longTermGoals: {
        ...goals,
        findByStatus: async (status) =>
          (await goals.getAll()).filter((row) => row.status === status),
      },
      settings: values(() => this.data.settings),
      meta: values(() => meta),
      backup: {
        readSnapshot: () => Promise.resolve(backupDataV1Schema.parse(this.data)),
        replaceAll: (data) => {
          this.data = backupDataV1Schema.parse(data);
          return Promise.resolve();
        },
        clearAll: (zone) => {
          this.data = emptyAccountData(zone);
          return Promise.resolve();
        },
      },
    };
  }
  async write<T>(
    operation: (repositories: OneDayRepositories) => Promise<T> | T,
  ): Promise<T> {
    const before = structuredClone(this.data);
    try {
      return await operation(this.repositories);
    } catch (error) {
      this.data = before;
      throw error;
    }
  }
}
