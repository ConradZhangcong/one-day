import { describe, expect, it } from 'vitest';

import { RecoveryService, TodoService } from '../../src/application';
import { decodeSchedulePoint, instantSchema, localDateSchema } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createSingleTask } from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('RecoveryService', () => {
  it('keeps missed and overdue groups mutually exclusive and preserves original time', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.saveMany([
        createSingleTask({
          id: 'task:missed',
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T09:00',
          }),
          deadlineAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' }),
        }),
        createSingleTask({
          id: 'task:overdue',
          plannedAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-12' }),
          deadlineAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T09:30',
          }),
        }),
      ]);
      const todos = new TodoService(unitOfWork);
      const recovery = new RecoveryService(unitOfWork, todos, {
        now: () => '2026-08-13T02:00:00Z',
      });

      const snapshot = await recovery.snapshot();
      expect(snapshot.missedPlanItems.map(({ task }) => task.id)).toEqual([
        'task:missed',
      ]);
      expect(snapshot.overdueItems.map(({ task }) => task.id)).toEqual(['task:overdue']);
      expect(snapshot.overdueItems[0]?.status).toMatchObject({
        missedPlan: true,
        overdue: true,
        recoveryGroup: 'overdue',
      });
      expect(snapshot.overdueItems[0]?.task.deadlineAt).toEqual({
        kind: 'timed',
        localDateTime: '2026-08-13T09:30',
      });
    } finally {
      await context.cleanup();
    }
  });

  it('builds day and ISO-week review buckets from action instants', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.saveMany([
        createSingleTask({
          id: 'task:completed',
          state: 'completed',
          completedAt: instantSchema.parse('2026-08-12T16:00:00Z'),
        }),
        createSingleTask({
          id: 'task:skipped-next-day',
          state: 'skipped',
          skippedAt: instantSchema.parse('2026-08-13T16:00:00Z'),
        }),
      ]);
      const recovery = new RecoveryService(unitOfWork, new TodoService(unitOfWork), {
        now: () => '2026-08-13T02:00:00Z',
      });

      const anchorDate = localDateSchema.parse('2026-08-13');
      const day = await recovery.review({ period: 'day', anchorDate });
      expect(day.completed.count).toBe(1);
      expect(day.skipped.count).toBe(0);
      const week = await recovery.review({ period: 'week', anchorDate });
      expect(week.startDate).toBe('2026-08-10');
      expect(week.endDateExclusive).toBe('2026-08-17');
      expect(week.completed.count).toBe(1);
      expect(week.skipped.count).toBe(1);
    } finally {
      await context.cleanup();
    }
  });
});
