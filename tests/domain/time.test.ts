import { describe, expect, it } from 'vitest';

import {
  DomainErrorCode,
  assertValidScheduleOrder,
  decodeInstant,
  decodeLocalDate,
  decodeLocalDateTime,
  decodeTimeZoneId,
  localDateTimeToInstant,
  schedulePointSchema,
  validateScheduleOrder,
} from '../../src/domain';

describe('time boundary decoders', () => {
  it('accepts exact JSON persistence formats', () => {
    expect(decodeLocalDate('2028-02-29')).toBe('2028-02-29');
    expect(decodeLocalDateTime('2026-08-13T09:05')).toBe('2026-08-13T09:05');
    expect(decodeInstant('2026-08-13T01:05:00Z')).toBe('2026-08-13T01:05:00Z');
    expect(decodeTimeZoneId('Asia/Shanghai')).toBe('Asia/Shanghai');
  });

  it.each([
    ['invalid calendar date', () => decodeLocalDate('2026-02-29')],
    ['date with a time', () => decodeLocalDate('2026-08-13T00:00')],
    ['date-time with seconds', () => decodeLocalDateTime('2026-08-13T09:05:00')],
    ['date-time with an offset', () => decodeLocalDateTime('2026-08-13T09:05Z')],
    ['instant without UTC Z', () => decodeInstant('2026-08-13T01:05:00+00:00')],
    ['numeric offset used as time zone', () => decodeTimeZoneId('+08:00')],
    ['unknown time zone', () => decodeTimeZoneId('Mars/Olympus')],
  ])('rejects %s', (_label, decode) => {
    expect(decode).toThrow();
  });

  it('rejects JavaScript Date instances and surplus fields', () => {
    expect(schedulePointSchema.safeParse(new Date()).success).toBe(false);
    expect(
      schedulePointSchema.safeParse({
        kind: 'allDay',
        date: '2026-08-13',
        utc: '2026-08-12T16:00:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('plan/deadline order', () => {
  const shanghai = decodeTimeZoneId('Asia/Shanghai');

  it('allows either value to be absent', () => {
    expect(
      validateScheduleOrder(
        { kind: 'none' },
        { kind: 'allDay', date: decodeLocalDate('2026-08-13') },
        shanghai,
      ),
    ).toEqual({ ok: true });
  });

  it('compares mixed all-day/timed points by local calendar date', () => {
    const date = decodeLocalDate('2026-08-13');
    const early = decodeLocalDateTime('2026-08-13T00:01');

    expect(
      validateScheduleOrder(
        { kind: 'allDay', date },
        { kind: 'timed', localDateTime: early },
        shanghai,
      ),
    ).toEqual({ ok: true });

    expect(
      validateScheduleOrder(
        {
          kind: 'timed',
          localDateTime: decodeLocalDateTime('2026-08-13T23:59'),
        },
        { kind: 'allDay', date },
        shanghai,
      ),
    ).toEqual({ ok: true });
  });

  it('rejects an earlier local date when either point is all-day', () => {
    const result = validateScheduleOrder(
      { kind: 'allDay', date: decodeLocalDate('2026-08-14') },
      {
        kind: 'timed',
        localDateTime: decodeLocalDateTime('2026-08-13T23:59'),
      },
      shanghai,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(DomainErrorCode.DEADLINE_BEFORE_PLAN);
    }
  });

  it('compares two timed points as instants', () => {
    let thrown: unknown;
    try {
      assertValidScheduleOrder(
        {
          kind: 'timed',
          localDateTime: decodeLocalDateTime('2026-08-13T10:00'),
        },
        {
          kind: 'timed',
          localDateTime: decodeLocalDateTime('2026-08-13T09:59'),
        },
        shanghai,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: DomainErrorCode.DEADLINE_BEFORE_PLAN,
    });
  });

  it('uses Temporal compatible disambiguation in a DST gap', () => {
    const newYork = decodeTimeZoneId('America/New_York');
    const skippedWallTime = decodeLocalDateTime('2026-03-08T02:30');

    expect(localDateTimeToInstant(skippedWallTime, newYork)).toBe('2026-03-08T07:30:00Z');

    const result = validateScheduleOrder(
      { kind: 'timed', localDateTime: skippedWallTime },
      {
        kind: 'timed',
        localDateTime: decodeLocalDateTime('2026-03-08T03:15'),
      },
      newYork,
    );
    expect(result.ok).toBe(false);
  });
});
