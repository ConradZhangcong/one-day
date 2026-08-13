import { afterEach, describe, expect, it } from 'vitest';

import {
  DexieUnitOfWork,
  INBOX_LIST_ID,
  createDexieRepositories,
  deleteListAndMoveContentsToInbox,
  toOccurrenceRecordRecord,
  toRecurrenceSeriesRecord,
  toSingleTaskRecord,
} from '../../../src/infrastructure/db';

import { createSeries, createSingleTask, createTaskList } from './fixtures';
import { createTestDatabase, type TestDatabaseContext } from './test-database';

const contexts: TestDatabaseContext[] = [];

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.cleanup()));
});

describe('Dexie cross-table transactions', () => {
  it('rolls every write back when an operation fails', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const unitOfWork = new DexieUnitOfWork(context.db);
    const task = createSingleTask();

    await expect(
      unitOfWork.write(async ({ singleTasks, settings }) => {
        await singleTasks.save(task);
        await settings.set('timeZone', 'Asia/Shanghai');
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    await expect(context.db.singleTasks.count()).resolves.toBe(0);
    await expect(context.db.settings.count()).resolves.toBe(0);
  });

  it('deletes a custom list while preserving tasks and series in the inbox', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const list = createTaskList();
    const task = createSingleTask({ listId: list.id });
    const { series, occurrence } = createSeries({ listId: list.id });
    await context.db.transaction(
      'rw',
      [
        context.db.lists,
        context.db.singleTasks,
        context.db.recurrenceSeries,
        context.db.occurrenceRecords,
      ],
      async () => {
        await context.db.lists.add({ ...list, archivedValue: 0 });
        await context.db.singleTasks.add(toSingleTaskRecord(task));
        await context.db.recurrenceSeries.add(toRecurrenceSeriesRecord(series));
        await context.db.occurrenceRecords.add(toOccurrenceRecordRecord(occurrence));
      },
    );

    await expect(deleteListAndMoveContentsToInbox(context.db, list.id)).resolves.toEqual({
      movedSingleTaskCount: 1,
      movedRecurrenceSeriesCount: 1,
    });

    const repositories = createDexieRepositories(context.db);
    await expect(repositories.lists.get(list.id)).resolves.toBeUndefined();
    await expect(repositories.singleTasks.get(task.id)).resolves.toMatchObject({
      listId: INBOX_LIST_ID,
    });
    const migratedSeries = await repositories.recurrenceSeries.get(series.id);
    expect(migratedSeries?.template.listId).toBe(INBOX_LIST_ID);
    await expect(
      repositories.occurrenceRecords.get(occurrence.occurrenceKey),
    ).resolves.toEqual(occurrence);
  });

  it('rolls list migration back if the inbox invariant is broken', async () => {
    const context = await createTestDatabase({ initializeInbox: false });
    contexts.push(context);
    const list = createTaskList();
    const task = createSingleTask({ listId: list.id });
    await context.db.lists.add({ ...list, archivedValue: 0 });
    await context.db.singleTasks.add(toSingleTaskRecord(task));

    await expect(deleteListAndMoveContentsToInbox(context.db, list.id)).rejects.toThrow(
      'system inbox',
    );

    await expect(context.db.lists.get(list.id)).resolves.toBeDefined();
    await expect(context.db.singleTasks.get(task.id)).resolves.toMatchObject({
      listId: list.id,
    });
  });

  it('decodes stored entities before list migration and rolls back corrupt data', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const list = createTaskList();
    const corruptTask = {
      ...toSingleTaskRecord(createSingleTask({ listId: list.id })),
      title: '',
    };
    await context.db.lists.add({ ...list, archivedValue: 0 });
    await context.db.singleTasks.add(corruptTask);

    await expect(deleteListAndMoveContentsToInbox(context.db, list.id)).rejects.toThrow();
    await expect(context.db.lists.get(list.id)).resolves.toBeDefined();
    await expect(context.db.singleTasks.get(corruptTask.id)).resolves.toMatchObject({
      listId: list.id,
      title: '',
    });
  });

  it('rejects stale recurrence list projections instead of orphaning a series', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const list = createTaskList();
    const { series } = createSeries({ listId: list.id });
    const staleSeries = {
      ...toRecurrenceSeriesRecord(series),
      listId: INBOX_LIST_ID,
    };
    await context.db.lists.add({ ...list, archivedValue: 0 });
    await context.db.recurrenceSeries.add(staleSeries);

    await expect(deleteListAndMoveContentsToInbox(context.db, list.id)).rejects.toThrow(
      'projection is inconsistent',
    );
    await expect(context.db.lists.get(list.id)).resolves.toBeDefined();
    await expect(context.db.recurrenceSeries.get(series.id)).resolves.toEqual(
      staleSeries,
    );
  });

  it('rejects a noncanonical persisted inbox before list deletion', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const list = createTaskList();
    await context.db.lists.add({ ...list, archivedValue: 0 });
    await context.db.lists.update(INBOX_LIST_ID, {
      isSystem: false,
      archived: true,
      archivedValue: 1,
    });

    await expect(deleteListAndMoveContentsToInbox(context.db, list.id)).rejects.toThrow(
      'not canonical',
    );
    await expect(context.db.lists.get(list.id)).resolves.toBeDefined();
  });
});
