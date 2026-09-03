import { afterEach, describe, expect, it } from 'vitest';

import { OccurrenceQueryService, RecurrenceService } from '../../src/application';
import { decodeLocalDate, occurrenceKeySchema } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import {
  createTestDatabase,
  type TestDatabaseContext,
} from '../infrastructure/db/test-database';

const contexts: TestDatabaseContext[] = [];
afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.cleanup()));
});

function draft(overrides: Record<string, unknown> = {}) {
  return {
    title: '每日复盘',
    notes: '',
    listId: 'system:inbox',
    tagNames: [],
    priority: 'none' as const,
    plannedAt: { kind: 'allDay' as const, date: '2026-08-10' },
    deadlineAt: { kind: 'none' as const },
    rule: { frequency: 'daily' as const, interval: 1, end: { kind: 'never' as const } },
    ...overrides,
  };
}

describe('RecurrenceService', () => {
  it('materializes one occurrence and skips missed dates after handling', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const uow = new DexieUnitOfWork(context.db);
    const service = new RecurrenceService(uow, {
      createId: () => 'fixed',
      now: () => '2026-08-13T01:00:00Z',
      detectTimeZone: () => 'Asia/Shanghai',
    });
    const series = await service.createSeries(draft());
    expect(
      await uow.repositories.occurrenceRecords.findBySeriesAndState(series.id, 'pending'),
    ).toHaveLength(1);
    await service.completeOccurrence(
      occurrenceKeySchema.parse(series.activeOccurrenceKey),
    );
    const updated = await uow.repositories.recurrenceSeries.get(series.id);
    const pending = await uow.repositories.occurrenceRecords.findBySeriesAndState(
      series.id,
      'pending',
    );
    const completed = await uow.repositories.occurrenceRecords.findBySeriesAndState(
      series.id,
      'completed',
    );
    expect(pending.map((item) => item.originalAnchor)).toEqual([
      { kind: 'allDay', date: '2026-08-14' },
    ]);
    expect(completed).toHaveLength(1);
    expect(updated?.activeOccurrenceKey).toBe(pending[0]?.occurrenceKey);
    const completedView = await new OccurrenceQueryService(
      uow,
      () => 'Asia/Shanghai',
    ).query({
      rangeStart: decodeLocalDate('2026-08-10'),
      rangeEnd: decodeLocalDate('2026-08-11'),
      includeHistory: true,
    });
    expect(completedView.items).toMatchObject([
      {
        key: series.activeOccurrenceKey,
        state: 'completed',
        completedAt: '2026-08-13T01:00:00Z',
      },
    ]);
  });

  it('persists a validated long-term goal link in the series template and query view', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const uow = new DexieUnitOfWork(context.db);
    await uow.repositories.longTermGoals.save({
      id: 'goal:recurrence',
      title: '保持健康',
      description: '',
      status: 'active',
      createdAt: context.now,
      updatedAt: context.now,
    });
    const service = new RecurrenceService(uow, {
      createId: () => 'goal-linked',
      now: () => '2026-08-13T01:00:00Z',
      detectTimeZone: () => 'Asia/Shanghai',
    });

    const series = await service.createSeries(
      draft({
        goalId: 'goal:recurrence',
        plannedAt: { kind: 'allDay', date: '2026-08-13' },
      }),
    );
    expect(series.template.goalId).toBe('goal:recurrence');

    const view = await new OccurrenceQueryService(uow, () => 'Asia/Shanghai').query({
      rangeStart: decodeLocalDate('2026-08-13'),
      rangeEnd: decodeLocalDate('2026-08-14'),
    });
    expect(view.items[0]).toMatchObject({ goalId: 'goal:recurrence' });
  });

  it('preserves history through pause, resume, revision update, and stop', async () => {
    const context = await createTestDatabase();
    contexts.push(context);
    const uow = new DexieUnitOfWork(context.db);
    let sequence = 0;
    const service = new RecurrenceService(uow, {
      createId: () => String(++sequence),
      now: () => '2026-08-13T01:00:00Z',
      detectTimeZone: () => 'Asia/Shanghai',
    });
    const series = await service.createSeries(draft());
    await service.skipOccurrence(occurrenceKeySchema.parse(series.activeOccurrenceKey));
    await service.pauseSeries(series.id);
    await service.resumeSeries(series.id);
    const revised = await service.updateSeries(
      series.id,
      draft({
        plannedAt: { kind: 'allDay', date: '2026-08-20' },
        rule: {
          frequency: 'weekly',
          interval: 1,
          weekdays: [4],
          end: { kind: 'count', count: 2 },
        },
      }),
    );
    expect(revised.revision).toBe(2);
    expect(
      await uow.repositories.occurrenceRecords.findBySeriesAndState(series.id, 'skipped'),
    ).toHaveLength(1);
    const history = await new OccurrenceQueryService(uow, () => 'Asia/Shanghai').query({
      rangeStart: decodeLocalDate('2026-08-10'),
      rangeEnd: decodeLocalDate('2026-08-11'),
      includeHistory: true,
    });
    expect(history.items).toMatchObject([
      {
        key: series.activeOccurrenceKey,
        state: 'skipped',
        plannedAt: { kind: 'allDay', date: '2026-08-10' },
      },
    ]);
    const stopped = await service.stopSeries(series.id);
    expect(stopped.status).toBe('archived');
    expect(
      await uow.repositories.occurrenceRecords.findBySeriesAndState(series.id, 'pending'),
    ).toHaveLength(0);
    expect(
      await uow.repositories.occurrenceRecords.findBySeriesAndState(series.id, 'skipped'),
    ).toHaveLength(1);
  });
});
