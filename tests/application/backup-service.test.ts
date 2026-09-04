import { describe, expect, it, vi } from 'vitest';

import { BackupService } from '../../src/application';
import {
  decodeLocalTime,
  decodeTimeZoneId,
  DomainErrorCode,
  longTermGoalSchema,
  reminderSchema,
  tagSchema,
} from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createMinimalBackup } from '../backup-fixtures';
import {
  createSeries,
  createSingleTask,
  createTaskList,
} from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('BackupService', () => {
  it('creates a deterministic self-validating export and summary', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(createSingleTask());
      const service = new BackupService(unitOfWork, {
        now: () => '2026-09-02T01:02:03Z',
      });

      const backup = await service.createExport();
      expect(backup.exportedAt).toBe('2026-09-02T01:02:03Z');
      expect(backup.data.singleTasks).toHaveLength(1);
      const inspection = service.inspect(JSON.stringify(backup));
      expect(inspection.summary).toMatchObject({
        timeZone: 'Asia/Shanghai',
        counts: { singleTasks: 1, lists: 1 },
      });
    } finally {
      await context.cleanup();
    }
  });

  it('rejects malformed JSON before any write', async () => {
    const context = await createTestDatabase();
    try {
      const service = new BackupService(new DexieUnitOfWork(context.db));
      expect(() => service.inspect('{broken')).toThrowError(
        expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_JSON }),
      );
      await expect(context.db.lists.count()).resolves.toBe(1);
    } finally {
      await context.cleanup();
    }
  });

  it('replaces existing data and calls the restored hook only after success', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(createSingleTask());
      const onRestored = vi.fn();
      const service = new BackupService(unitOfWork, { onRestored });
      const inspection = service.inspect(JSON.stringify(createMinimalBackup()));

      await expect(service.restore(inspection)).resolves.toMatchObject({
        counts: { singleTasks: 0, lists: 1 },
      });
      expect(onRestored).toHaveBeenCalledOnce();
      await expect(context.db.singleTasks.count()).resolves.toBe(0);

      const invalid = {
        ...inspection,
        backup: {
          ...inspection.backup,
          timeZone: decodeTimeZoneId('Europe/Paris'),
        },
      };
      await expect(service.restore(invalid)).rejects.toMatchObject({
        code: DomainErrorCode.BACKUP_INVALID_DATA,
      });
      expect(onRestored).toHaveBeenCalledOnce();
    } finally {
      await context.cleanup();
    }
  });

  it('round-trips every recoverable entity and reminder delivery state', async () => {
    const context = await createTestDatabase();
    try {
      let commits = 0;
      const unitOfWork = new DexieUnitOfWork(context.db, () => {
        commits += 1;
      });
      const list = createTaskList();
      const tag = tagSchema.parse({ id: 'tag:client', name: '客户', color: 'blue' });
      const goal = longTermGoalSchema.parse({
        id: 'goal:launch',
        title: '发布产品',
        description: '',
        status: 'active',
        createdAt: context.now,
        updatedAt: context.now,
      });
      const task = createSingleTask({
        id: 'task:linked',
        listId: list.id,
        tagIds: [tag.id],
        goalId: goal.id,
      });
      const { series, occurrence } = createSeries({ listId: list.id });
      const reminder = reminderSchema.parse({
        id: 'reminder:linked',
        ownerKind: 'task',
        ownerId: task.id,
        target: 'planned',
        offsetMinutes: 5,
        scheduleRevision: 2,
        snoozeRevision: 1,
        lastDeliveryKey: 'already-delivered',
      });
      await unitOfWork.write(async (repositories) => {
        await repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
        await repositories.settings.set('allDayReminderTime', decodeLocalTime('08:30'));
        await repositories.lists.save(list);
        await repositories.tags.save(tag);
        await repositories.longTermGoals.save(goal);
        await repositories.singleTasks.save(task);
        await repositories.recurrenceSeries.save(series);
        await repositories.occurrenceRecords.save(occurrence);
        await repositories.reminders.save(reminder);
      });
      const service = new BackupService(unitOfWork, {
        now: () => '2026-09-02T01:02:03Z',
      });
      const exported = await service.createExport();

      await unitOfWork.write(({ singleTasks }) =>
        singleTasks.save(createSingleTask({ id: 'task:temporary' })),
      );
      const commitsBeforeRestore = commits;
      await service.restore(service.inspect(JSON.stringify(exported)));
      expect(commits).toBe(commitsBeforeRestore + 1);
      const roundTrip = await service.createExport();
      expect(roundTrip.data).toEqual(exported.data);
      expect(roundTrip.data.reminders[0]).toMatchObject({
        lastDeliveryKey: 'already-delivered',
        snoozeRevision: 1,
      });
      expect(roundTrip.data.settings.allDayReminderTime).toBe('08:30');
      expect(
        roundTrip.data.singleTasks.some((item) => item.id === 'task:temporary'),
      ).toBe(false);
    } finally {
      await context.cleanup();
    }
  });

  it('clears with the decoded device time zone and runs hooks only after commit', async () => {
    const context = await createTestDatabase();
    try {
      let commits = 0;
      const unitOfWork = new DexieUnitOfWork(context.db, () => {
        commits += 1;
      });
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Europe/Paris');
      await unitOfWork.repositories.singleTasks.save(createSingleTask());
      const onCleared = vi.fn();
      const service = new BackupService(unitOfWork, {
        detectTimeZone: () => 'Asia/Shanghai',
        onCleared,
      });

      await service.clearLocalData();

      expect(commits).toBe(1);
      expect(onCleared).toHaveBeenCalledOnce();
      await expect(context.db.singleTasks.count()).resolves.toBe(0);
      await expect(
        unitOfWork.repositories.settings.get('applicationTimeZone'),
      ).resolves.toBe('Asia/Shanghai');
      await expect(
        unitOfWork.repositories.settings.get('allDayReminderTime'),
      ).resolves.toBeUndefined();
    } finally {
      await context.cleanup();
    }
  });

  it('rejects an invalid detected time zone before writing or calling the hook', async () => {
    const context = await createTestDatabase();
    try {
      const onCleared = vi.fn();
      let commits = 0;
      const service = new BackupService(
        new DexieUnitOfWork(context.db, () => {
          commits += 1;
        }),
        { detectTimeZone: () => 'Mars/Olympus', onCleared },
      );

      await expect(service.clearLocalData()).rejects.toBeDefined();
      expect(commits).toBe(0);
      expect(onCleared).not.toHaveBeenCalled();
      await expect(context.db.lists.count()).resolves.toBe(1);
    } finally {
      await context.cleanup();
    }
  });
});
