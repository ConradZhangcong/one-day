import { afterEach, describe, expect, it } from 'vitest';

import {
  OneDayDatabase,
  createDexieRepositories,
  createInboxList,
} from '../../../src/infrastructure/db';

import { createSingleTask } from './fixtures';
import { createTestDatabase, type TestDatabaseContext } from './test-database';

const contexts: TestDatabaseContext[] = [];

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.cleanup()));
});

describe('OneDayDatabase', () => {
  it('persists domain entities and rebuildable index projections across reopen', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const repositories = createDexieRepositories(context.db);
    const task = createSingleTask();

    await repositories.singleTasks.save(task);
    context.db.close();

    const reopened = new OneDayDatabase(context.name);
    context.db = reopened;
    await reopened.open();
    const reopenedRepositories = createDexieRepositories(reopened);

    await expect(reopenedRepositories.singleTasks.get(task.id)).resolves.toEqual(task);
    await expect(reopened.singleTasks.get(task.id)).resolves.toMatchObject({
      plannedLocalDate: '2026-08-14',
      deadlineLocalDate: '2026-08-14',
      normalizedTitle: '准备周会',
    });
  });

  it('creates the system inbox in canonical form', async () => {
    const context = await createTestDatabase();
    contexts.push(context);

    await expect(context.db.lists.toArray()).resolves.toEqual([
      expect.objectContaining(createInboxList()),
    ]);
  });
});
