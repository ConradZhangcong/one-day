import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

import {
  OneDayDatabase,
  V1_STORES,
  createDexieRepositories,
} from '../../../src/infrastructure/db';

import { V1_MIGRATION_FIXTURE } from './migration-fixtures';
import { createTestDatabase } from './test-database';

describe('database migration fixtures', () => {
  it('opens and decodes the frozen v1 persisted shape', async () => {
    const context = await createTestDatabase({ initializeInbox: false });
    try {
      await context.db.transaction(
        'rw',
        [context.db.lists, context.db.singleTasks],
        async () => {
          await context.db.lists.bulkAdd([...V1_MIGRATION_FIXTURE.lists]);
          await context.db.singleTasks.bulkAdd([...V1_MIGRATION_FIXTURE.singleTasks]);
        },
      );
      context.db.close();

      const reopened = new OneDayDatabase(context.name);
      context.db = reopened;
      await reopened.open();
      const repositories = createDexieRepositories(reopened);

      await expect(
        repositories.singleTasks.get('task:v1-fixture'),
      ).resolves.toMatchObject({
        title: '旧版本任务',
        plannedAt: { kind: 'allDay', date: '2026-08-13' },
      });
    } finally {
      await context.cleanup();
    }
  });

  it('upgrades a frozen v1 database to v2 without changing old tasks', async () => {
    const name = `one-day-v1-upgrade-${Date.now()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores(V1_STORES);
    await legacy.open();
    await legacy.table('lists').bulkAdd([...V1_MIGRATION_FIXTURE.lists]);
    await legacy.table('singleTasks').bulkAdd([...V1_MIGRATION_FIXTURE.singleTasks]);
    legacy.close();

    const upgraded = new OneDayDatabase(name);
    try {
      await upgraded.open();
      const repositories = createDexieRepositories(upgraded);
      const task = await repositories.singleTasks.get('task:v1-fixture');
      expect(task).toMatchObject({ title: '旧版本任务' });
      expect(task).not.toHaveProperty('goalId');
      await expect(repositories.longTermGoals.getAll()).resolves.toEqual([]);
    } finally {
      upgraded.close();
      await Dexie.delete(name);
    }
  });
});
