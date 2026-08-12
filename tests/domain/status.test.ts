import { describe, expect, it } from 'vitest';

import {
  decodeInstant,
  decodeLocalDate,
  decodeLocalDateTime,
  decodeTimeZoneId,
  deriveTaskStatus,
} from '../../src/domain';

describe('derived task status', () => {
  const shanghai = decodeTimeZoneId('Asia/Shanghai');

  it('does not miss an all-day plan until its local date has ended', () => {
    const task = {
      state: 'pending' as const,
      plannedAt: {
        kind: 'allDay' as const,
        date: decodeLocalDate('2026-08-13'),
      },
      deadlineAt: { kind: 'none' as const },
    };

    expect(
      deriveTaskStatus(task, decodeInstant('2026-08-13T15:59:59Z'), shanghai),
    ).toEqual({ missedPlan: false, overdue: false, recoveryGroup: 'none' });
    expect(
      deriveTaskStatus(task, decodeInstant('2026-08-13T16:00:00Z'), shanghai),
    ).toEqual({
      missedPlan: true,
      overdue: false,
      recoveryGroup: 'missedPlan',
    });
  });

  it('does not consider a precise point past at the exact instant', () => {
    const task = {
      state: 'pending' as const,
      plannedAt: {
        kind: 'timed' as const,
        localDateTime: decodeLocalDateTime('2026-08-13T09:00'),
      },
      deadlineAt: { kind: 'none' as const },
    };

    expect(
      deriveTaskStatus(task, decodeInstant('2026-08-13T01:00:00Z'), shanghai)
        .missedPlan,
    ).toBe(false);
    expect(
      deriveTaskStatus(
        task,
        decodeInstant('2026-08-13T01:00:00.000000001Z'),
        shanghai,
      ).missedPlan,
    ).toBe(true);
  });

  it('uses overdue as the exclusive main recovery group', () => {
    const status = deriveTaskStatus(
      {
        state: 'pending',
        plannedAt: {
          kind: 'allDay',
          date: decodeLocalDate('2026-08-11'),
        },
        deadlineAt: {
          kind: 'allDay',
          date: decodeLocalDate('2026-08-12'),
        },
      },
      decodeInstant('2026-08-13T01:00:00Z'),
      shanghai,
    );

    expect(status).toEqual({
      missedPlan: true,
      overdue: true,
      recoveryGroup: 'overdue',
    });
  });

  it.each(['completed', 'skipped'] as const)(
    'never derives recovery state for %s tasks',
    (state) => {
      expect(
        deriveTaskStatus(
          {
            state,
            plannedAt: {
              kind: 'allDay',
              date: decodeLocalDate('2020-01-01'),
            },
            deadlineAt: {
              kind: 'allDay',
              date: decodeLocalDate('2020-01-01'),
            },
          },
          decodeInstant('2026-08-13T01:00:00Z'),
          shanghai,
        ),
      ).toEqual({ missedPlan: false, overdue: false, recoveryGroup: 'none' });
    },
  );

  it('evaluates timed points in the selected DST-aware application zone', () => {
    const newYork = decodeTimeZoneId('America/New_York');
    const task = {
      state: 'pending' as const,
      plannedAt: {
        kind: 'timed' as const,
        localDateTime: decodeLocalDateTime('2026-11-01T01:30'),
      },
      deadlineAt: { kind: 'none' as const },
    };

    // compatible chooses the earlier 01:30 during the fall-back overlap.
    expect(
      deriveTaskStatus(task, decodeInstant('2026-11-01T05:30:00Z'), newYork)
        .missedPlan,
    ).toBe(false);
    expect(
      deriveTaskStatus(
        task,
        decodeInstant('2026-11-01T05:30:00.000000001Z'),
        newYork,
      ).missedPlan,
    ).toBe(true);
  });
});
