import { describe, expect, it } from 'vitest';

import {
  createOccurrenceKey,
  localDateSchema,
  projectOccurrenceRange,
  type ScheduledPoint,
} from '../../src/domain';

function allDay(date: string): ScheduledPoint {
  return { kind: 'allDay', date: localDateSchema.parse(date) };
}

describe('fixed recurrence projector', () => {
  it('preserves daily phase and COUNT across range chunks', () => {
    const input = {
      seriesId: 'series:daily',
      revision: 2,
      anchor: allDay('2026-01-01'),
      rule: {
        frequency: 'daily' as const,
        interval: 3,
        end: { kind: 'count' as const, count: 5 },
      },
      limit: 10,
    };
    const all = projectOccurrenceRange(input);
    const chunk = projectOccurrenceRange({ ...input, rangeStart: allDay('2026-01-07') });
    expect(all.map((item) => item.originalAnchor)).toEqual([
      allDay('2026-01-01'),
      allDay('2026-01-04'),
      allDay('2026-01-07'),
      allDay('2026-01-10'),
      allDay('2026-01-13'),
    ]);
    expect(chunk.map((item) => item.ordinal)).toEqual([3, 4, 5]);
    expect(chunk.map((item) => item.occurrenceKey)).toEqual(
      all.slice(2).map((item) => item.occurrenceKey),
    );
  });

  it('expands ISO weeks with multiple weekdays in stable order', () => {
    const result = projectOccurrenceRange({
      seriesId: 'series:weekly',
      revision: 1,
      anchor: allDay('2026-12-28'),
      rule: {
        frequency: 'weekly',
        interval: 2,
        weekdays: [1, 3, 7],
        end: { kind: 'never' },
      },
      limit: 6,
    });
    expect(result.map((item) => item.originalAnchor)).toEqual([
      allDay('2026-12-28'),
      allDay('2026-12-30'),
      allDay('2027-01-03'),
      allDay('2027-01-11'),
      allDay('2027-01-13'),
      allDay('2027-01-17'),
    ]);
  });

  it('skips invalid month days and non-leap years while lastDay remains valid', () => {
    expect(
      projectOccurrenceRange({
        seriesId: 'series:month',
        revision: 1,
        anchor: allDay('2026-01-31'),
        rule: {
          frequency: 'monthly',
          interval: 1,
          monthMode: 'sameDay',
          end: { kind: 'count', count: 3 },
        },
        limit: 3,
      }).map((item) => item.originalAnchor),
    ).toEqual([allDay('2026-01-31'), allDay('2026-03-31'), allDay('2026-05-31')]);
    expect(
      projectOccurrenceRange({
        seriesId: 'series:leap',
        revision: 1,
        anchor: allDay('2024-02-29'),
        rule: { frequency: 'yearly', interval: 1, end: { kind: 'count', count: 3 } },
        limit: 3,
      }).map((item) => item.originalAnchor),
    ).toEqual([allDay('2024-02-29'), allDay('2028-02-29'), allDay('2032-02-29')]);
  });

  it('keeps inclusive end dates and stable identities', () => {
    const result = projectOccurrenceRange({
      seriesId: 'series:end',
      revision: 4,
      anchor: allDay('2026-08-01'),
      rule: {
        frequency: 'daily',
        interval: 1,
        end: { kind: 'date', inclusive: localDateSchema.parse('2026-08-03') },
      },
      limit: 10,
    });
    expect(result).toHaveLength(3);
    expect(result[2]?.occurrenceKey).toBe(
      createOccurrenceKey('series:end', 4, allDay('2026-08-03')),
    );
  });
});
