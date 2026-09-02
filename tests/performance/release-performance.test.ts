import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { CalendarService, OccurrenceQueryService, TodoService } from '@/application';
import {
  decodeLocalDate,
  decodeSchedulePoint,
  recurrenceSeriesSchema,
  singleTaskSchema,
  type SchedulePoint,
} from '@/domain';
import { DexieUnitOfWork } from '@/infrastructure/db';
import {
  createSeries,
  createSingleTask,
  FIXTURE_INSTANT,
} from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

const TASK_COUNT = 2_000;
const SERIES_COUNT = 200;

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
}

async function measure(operation: () => Promise<unknown>) {
  await operation();
  const samples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const start = performance.now();
    await operation();
    samples.push(performance.now() - start);
  }
  return median(samples);
}

function schedules(
  index: number,
  date: string,
): {
  plannedAt: SchedulePoint;
  deadlineAt: SchedulePoint;
} {
  switch (index % 5) {
    case 0:
      return { plannedAt: { kind: 'none' }, deadlineAt: { kind: 'none' } };
    case 1:
      return {
        plannedAt: { kind: 'allDay', date: decodeLocalDate(date) },
        deadlineAt: { kind: 'none' },
      };
    case 2:
      return {
        plannedAt: decodeSchedulePoint({
          kind: 'timed',
          localDateTime: `${date}T09:30`,
        }),
        deadlineAt: { kind: 'none' },
      };
    case 3:
      return {
        plannedAt: { kind: 'none' },
        deadlineAt: { kind: 'allDay', date: decodeLocalDate(date) },
      };
    default:
      return {
        plannedAt: { kind: 'allDay', date: decodeLocalDate(date) },
        deadlineAt: decodeSchedulePoint({
          kind: 'timed',
          localDateTime: `${date}T18:00`,
        }),
      };
  }
}

describe('release performance budgets', () => {
  it('keeps large snapshots and recurrence ranges within the approved median budgets', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      const taskStart = Temporal.PlainDate.from('2026-08-13');
      const tasks = Array.from({ length: TASK_COUNT }, (_, index) => {
        const date = taskStart.add({ days: index % 14 }).toString();
        const completed = index % 7 === 0;
        return singleTaskSchema.parse({
          ...createSingleTask({ id: `task:performance:${index}` }),
          title: `性能任务 ${index}`,
          ...schedules(index, date),
          state: completed ? 'completed' : 'pending',
          ...(completed ? { completedAt: FIXTURE_INSTANT } : {}),
        });
      });
      const seriesWithOccurrences = Array.from({ length: SERIES_COUNT }, (_, index) => {
        const fixture = createSeries({ id: `series:performance:${index}` });
        const rule =
          index % 3 === 0
            ? {
                frequency: 'weekly' as const,
                interval: 1,
                weekdays: [1, 3, 5],
                end: { kind: 'never' as const },
              }
            : index % 3 === 1
              ? {
                  frequency: 'monthly' as const,
                  interval: 1,
                  monthMode: 'sameDay' as const,
                  end: { kind: 'never' as const },
                }
              : {
                  frequency: 'yearly' as const,
                  interval: 1,
                  end: { kind: 'never' as const },
                };
        return {
          series: recurrenceSeriesSchema.parse({ ...fixture.series, rule }),
          occurrence: fixture.occurrence,
        };
      });
      await unitOfWork.repositories.singleTasks.saveMany(tasks);
      await unitOfWork.repositories.recurrenceSeries.saveMany(
        seriesWithOccurrences.map(({ series }) => series),
      );
      await unitOfWork.repositories.occurrenceRecords.saveMany(
        seriesWithOccurrences.map(({ occurrence }) => occurrence),
      );

      const todo = new TodoService(unitOfWork, {
        now: () => '2026-08-13T01:00:00Z',
        detectTimeZone: () => 'Asia/Shanghai',
      });
      const calendar = new CalendarService(unitOfWork, () => 'Asia/Shanghai');
      const occurrences = new OccurrenceQueryService(unitOfWork, () => 'Asia/Shanghai');
      const snapshotMedian = await measure(() => todo.snapshot());
      const calendarMedian = await measure(() =>
        calendar.query({
          rangeStart: decodeLocalDate('2026-08-13'),
          rangeEnd: decodeLocalDate('2026-08-27'),
        }),
      );
      const recurrenceMedian = await measure(() =>
        occurrences.query({
          rangeStart: decodeLocalDate('2026-08-13'),
          rangeEnd: decodeLocalDate('2027-08-14'),
        }),
      );

      console.info(
        JSON.stringify({
          environment: `node ${process.version}`,
          taskCount: TASK_COUNT,
          seriesCount: SERIES_COUNT,
          medianMs: {
            snapshot: Math.round(snapshotMedian),
            calendar14Days: Math.round(calendarMedian),
            recurrence366Days: Math.round(recurrenceMedian),
          },
        }),
      );
      expect(snapshotMedian).toBeLessThanOrEqual(1_000);
      expect(calendarMedian).toBeLessThanOrEqual(1_000);
      expect(recurrenceMedian).toBeLessThanOrEqual(2_000);
    } finally {
      await context.cleanup();
    }
  });
});
