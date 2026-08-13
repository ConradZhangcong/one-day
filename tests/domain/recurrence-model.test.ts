import { describe, expect, it } from 'vitest';

import {
  createOccurrenceKey,
  decodeLocalDate,
  fixedRecurrenceRuleSchema,
  occurrenceRecordSchema,
  parseOccurrenceKey,
  recurrenceSeriesSchema,
  taskTemplateSchema,
} from '../../src/domain';

const anchor = {
  kind: 'allDay' as const,
  date: decodeLocalDate('2026-08-13'),
};

function template() {
  return taskTemplateSchema.parse({
    title: 'Weekly review',
    notes: '',
    listId: 'inbox',
    tagIds: [],
    priority: 'medium',
    plannedAt: anchor,
    deadlineAt: { kind: 'none' },
  });
}

describe('fixed recurrence rules', () => {
  it('accepts each supported fixed calendar frequency', () => {
    expect(
      fixedRecurrenceRuleSchema.parse({
        frequency: 'daily',
        interval: 3,
        end: { kind: 'count', count: 5 },
      }),
    ).toMatchObject({ frequency: 'daily', interval: 3 });
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'weekly',
        interval: 2,
        weekdays: [1, 3, 7],
        end: { kind: 'date', inclusive: '2026-12-31' },
      }).success,
    ).toBe(true);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'monthly',
        interval: 1,
        monthMode: 'lastDay',
      }).success,
    ).toBe(true);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'yearly',
        interval: 1,
      }).success,
    ).toBe(true);
  });

  it('rejects invalid interval, COUNT, weekdays and irrelevant fields', () => {
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'daily',
        interval: 0,
      }).success,
    ).toBe(false);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'daily',
        interval: 1,
        end: { kind: 'count', count: 0 },
      }).success,
    ).toBe(false);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'weekly',
        interval: 1,
        weekdays: [1, 1],
      }).success,
    ).toBe(false);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'weekly',
        interval: 1,
        weekdays: [0, 8],
      }).success,
    ).toBe(false);
    expect(
      fixedRecurrenceRuleSchema.safeParse({
        frequency: 'daily',
        interval: 1,
        weekdays: [1],
      }).success,
    ).toBe(false);
  });
});

describe('stable occurrence identity', () => {
  it('round-trips reserved series-id characters canonically', () => {
    const key = createOccurrenceKey('series:work/%', 12, anchor);

    expect(key).toBe('occ:v1:series%3Awork%2F%25:12:d:2026-08-13');
    expect(parseOccurrenceKey(key)).toEqual({
      seriesId: 'series:work/%',
      revision: 12,
      originalAnchor: anchor,
    });
  });

  it('rejects revision zero because series revisions start at one', () => {
    expect(() => createOccurrenceKey('series-1', 0, anchor)).toThrow();
  });

  it('uses the original anchor even after a one-off reschedule', () => {
    const key = createOccurrenceKey('series-1', 1, anchor);
    const record = occurrenceRecordSchema.parse({
      occurrenceKey: key,
      seriesId: 'series-1',
      originalAnchor: anchor,
      overridePlannedAt: { kind: 'allDay', date: '2026-08-20' },
      state: 'pending',
    });

    expect(record.occurrenceKey).toBe(key);
    expect(record.originalAnchor).toEqual(anchor);
    expect(record.overridePlannedAt).toEqual({
      kind: 'allDay',
      date: '2026-08-20',
    });
  });

  it('rejects a key that identifies another series or original anchor', () => {
    const key = createOccurrenceKey('series-2', 1, anchor);
    expect(
      occurrenceRecordSchema.safeParse({
        occurrenceKey: key,
        seriesId: 'series-1',
        originalAnchor: anchor,
        state: 'pending',
      }).success,
    ).toBe(false);

    const rightSeriesKey = createOccurrenceKey('series-1', 1, anchor);
    expect(
      occurrenceRecordSchema.safeParse({
        occurrenceKey: rightSeriesKey,
        seriesId: 'series-1',
        originalAnchor: { kind: 'allDay', date: '2026-08-14' },
        state: 'pending',
      }).success,
    ).toBe(false);
  });

  it('requires matching history timestamps', () => {
    const key = createOccurrenceKey('series-1', 1, anchor);
    const base = {
      occurrenceKey: key,
      seriesId: 'series-1',
      originalAnchor: anchor,
    };

    expect(
      occurrenceRecordSchema.safeParse({ ...base, state: 'completed' }).success,
    ).toBe(false);
    expect(
      occurrenceRecordSchema.safeParse({
        ...base,
        state: 'completed',
        completedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      occurrenceRecordSchema.safeParse({
        ...base,
        state: 'skipped',
        skippedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(true);
  });
});

describe('recurrence series invariants', () => {
  function series(status: 'active' | 'paused' | 'ended' | 'archived') {
    const key = createOccurrenceKey('series-1', 1, anchor);
    return {
      id: 'series-1',
      template: template(),
      anchor: 'planned',
      rule: { frequency: 'weekly', interval: 1, weekdays: [4] },
      status,
      ...(status === 'active' || status === 'paused' ? { activeOccurrenceKey: key } : {}),
      revision: 1,
      createdAt: '2026-08-13T01:00:00Z',
      updatedAt: '2026-08-13T01:00:00Z',
    };
  }

  it.each(['active', 'paused'] as const)(
    'requires one active key for a %s series',
    (status) => {
      expect(recurrenceSeriesSchema.safeParse(series(status)).success).toBe(true);
      const { activeOccurrenceKey, ...withoutKey } = series(status);
      expect(activeOccurrenceKey).toBeDefined();
      expect(recurrenceSeriesSchema.safeParse(withoutKey).success).toBe(false);
    },
  );

  it.each(['ended', 'archived'] as const)(
    'forbids an active key for a terminal %s series',
    (status) => {
      expect(recurrenceSeriesSchema.safeParse(series(status)).success).toBe(true);
      expect(
        recurrenceSeriesSchema.safeParse({
          ...series(status),
          activeOccurrenceKey: createOccurrenceKey('series-1', 1, anchor),
        }).success,
      ).toBe(false);
    },
  );

  it('requires a scheduled point at the selected anchor', () => {
    expect(
      recurrenceSeriesSchema.safeParse({
        ...series('active'),
        template: {
          ...template(),
          plannedAt: { kind: 'none' },
        },
      }).success,
    ).toBe(false);
  });

  it('requires the active key to match series id and revision', () => {
    expect(
      recurrenceSeriesSchema.safeParse({
        ...series('active'),
        activeOccurrenceKey: createOccurrenceKey('series-1', 2, anchor),
      }).success,
    ).toBe(false);
    expect(
      recurrenceSeriesSchema.safeParse({
        ...series('active'),
        activeOccurrenceKey: createOccurrenceKey('another-series', 1, anchor),
      }).success,
    ).toBe(false);
  });
});
