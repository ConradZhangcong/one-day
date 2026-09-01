import { describe, expect, it } from 'vitest';

import { CalendarService } from '../../src/application';
import { decodeLocalDate, singleTaskSchema } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createSeries, createSingleTask } from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('CalendarService', () => {
  it('projects planned tasks once and deadline-only tasks as deadline markers', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.singleTasks.saveMany([
        createSingleTask({
          id: 'task:planned',
          plannedAt: { kind: 'allDay', date: decodeLocalDate('2026-08-14') },
          deadlineAt: { kind: 'allDay', date: decodeLocalDate('2026-08-15') },
        }),
        createSingleTask({
          id: 'task:deadline',
          plannedAt: { kind: 'none' },
          deadlineAt: { kind: 'allDay', date: decodeLocalDate('2026-08-15') },
        }),
      ]);
      const result = await new CalendarService(unitOfWork, () => 'Asia/Shanghai').query({
        rangeStart: decodeLocalDate('2026-08-14'),
        rangeEnd: decodeLocalDate('2026-08-16'),
      });
      expect(result.items).toMatchObject([
        { ownerId: 'task:planned', kind: 'planned' },
        { ownerId: 'task:deadline', kind: 'deadline' },
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it('keeps completed tasks behind the state filter and projects active occurrences read-only', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      const completed = singleTaskSchema.parse({
        ...createSingleTask({ id: 'task:done' }),
        state: 'completed',
        completedAt: context.now,
      });
      await unitOfWork.repositories.singleTasks.save(completed);
      const { series, occurrence } = createSeries();
      await unitOfWork.repositories.recurrenceSeries.save(series);
      await unitOfWork.repositories.occurrenceRecords.save(occurrence);
      const service = new CalendarService(unitOfWork, () => 'Asia/Shanghai');
      const input = {
        rangeStart: decodeLocalDate('2026-08-14'),
        rangeEnd: decodeLocalDate('2026-08-15'),
      };
      const pending = await service.query(input);
      expect(pending.items).toMatchObject([
        { ownerKind: 'occurrence', readonly: true, title: '每周回顾' },
      ]);
      const done = await service.query({ ...input, state: 'completed' });
      expect(done.items).toMatchObject([{ ownerId: 'task:done', state: 'completed' }]);
    } finally {
      await context.cleanup();
    }
  });
});
