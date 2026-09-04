import { describe, expect, it, vi } from 'vitest';

import {
  backupDataV1Schema,
  decodeTimeZoneId,
  longTermGoalSchema,
  reminderSchema,
  tagSchema,
} from '../../../src/domain';
import { DexieUnitOfWork } from '../../../src/infrastructure/db';
import { createMinimalBackup } from '../../backup-fixtures';
import { createSeries, createSingleTask, createTaskList } from './fixtures';
import { createTestDatabase } from './test-database';

describe('Dexie backup repository', () => {
  it('reads a decoded consistent snapshot and rebuilds indexed records', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      const oldTask = createSingleTask({ id: 'task:old' });
      await unitOfWork.repositories.singleTasks.save(oldTask);
      expect(await unitOfWork.repositories.backup.readSnapshot()).toMatchObject({
        singleTasks: [{ id: 'task:old' }],
        settings: { applicationTimeZone: 'Asia/Shanghai' },
      });

      const replacement = backupDataV1Schema.parse({
        ...createMinimalBackup().data,
        singleTasks: [createSingleTask({ id: 'task:new', title: '新的任务' })],
      });
      await unitOfWork.write(({ backup }) => backup.replaceAll(replacement));

      await expect(context.db.singleTasks.get('task:old')).resolves.toBeUndefined();
      await expect(context.db.singleTasks.get('task:new')).resolves.toMatchObject({
        normalizedTitle: '新的任务',
        plannedLocalDate: '2026-08-14',
      });
      await expect(unitOfWork.repositories.backup.readSnapshot()).resolves.toEqual(
        replacement,
      );
    } finally {
      await context.cleanup();
    }
  });

  it('rolls back every cleared and written table when a later write fails', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(createSingleTask({ id: 'keep' }));
      const before = await Promise.all(context.db.tables.map((table) => table.toArray()));
      const duplicateNames = [
        tagSchema.parse({ id: 'tag:one', name: '客户', color: 'blue' }),
        tagSchema.parse({ id: 'tag:two', name: '客户', color: 'green' }),
      ];
      const invalidForUniqueIndex = backupDataV1Schema.parse({
        ...createMinimalBackup().data,
        tags: duplicateNames,
      });

      await expect(
        unitOfWork.write(({ backup }) => backup.replaceAll(invalidForUniqueIndex)),
      ).rejects.toBeDefined();
      const after = await Promise.all(context.db.tables.map((table) => table.toArray()));
      expect(after).toEqual(before);
    } finally {
      await context.cleanup();
    }
  });

  it('clears every table and recreates only fresh-install system data', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      const list = createTaskList();
      const tag = tagSchema.parse({ id: 'tag:client', name: '客户', color: 'blue' });
      const goal = longTermGoalSchema.parse({
        id: 'goal:one',
        title: '长期目标',
        description: '',
        status: 'active',
        createdAt: context.now,
        updatedAt: context.now,
      });
      const task = createSingleTask({ listId: list.id, tagIds: [tag.id] });
      const { series, occurrence } = createSeries({ listId: list.id });
      const reminder = reminderSchema.parse({
        id: 'reminder:one',
        ownerKind: 'task',
        ownerId: task.id,
        target: 'planned',
        offsetMinutes: 0,
        scheduleRevision: 0,
        snoozeRevision: 0,
      });
      await unitOfWork.write(async (repositories) => {
        await repositories.settings.set('applicationTimeZone', 'Europe/Paris');
        await repositories.settings.set('allDayReminderTime', '08:30');
        await repositories.meta.set('internalRevision', 7);
        await repositories.lists.save(list);
        await repositories.tags.save(tag);
        await repositories.longTermGoals.save(goal);
        await repositories.singleTasks.save(task);
        await repositories.recurrenceSeries.save(series);
        await repositories.occurrenceRecords.save(occurrence);
        await repositories.reminders.save(reminder);
      });

      await unitOfWork.write(({ backup }) =>
        backup.clearAll(decodeTimeZoneId('Asia/Shanghai')),
      );

      await expect(context.db.lists.toArray()).resolves.toEqual([
        expect.objectContaining({
          id: 'system:inbox',
          name: '收件箱',
          isSystem: true,
          archived: false,
          order: 0,
        }),
      ]);
      await expect(context.db.settings.toArray()).resolves.toEqual([
        { key: 'applicationTimeZone', value: 'Asia/Shanghai' },
      ]);
      for (const table of context.db.tables.filter(
        ({ name }) => name !== 'lists' && name !== 'settings',
      )) {
        await expect(table.count(), table.name).resolves.toBe(0);
      }
    } finally {
      await context.cleanup();
    }
  });

  it('rolls back the full clear when fresh-install data cannot be written', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Europe/Paris');
      await unitOfWork.repositories.singleTasks.save(createSingleTask({ id: 'keep' }));
      const before = await Promise.all(context.db.tables.map((table) => table.toArray()));
      vi.spyOn(context.db.lists, 'add').mockRejectedValueOnce(
        new Error('injected inbox write failure'),
      );

      await expect(
        unitOfWork.write(({ backup }) =>
          backup.clearAll(decodeTimeZoneId('Asia/Shanghai')),
        ),
      ).rejects.toThrow('injected inbox write failure');
      const after = await Promise.all(context.db.tables.map((table) => table.toArray()));
      expect(after).toEqual(before);
    } finally {
      await context.cleanup();
    }
  });
});
