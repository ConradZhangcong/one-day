import { describe, expect, it } from 'vitest';

import {
  decodeLocalTime,
  decodeSchedulePoint,
  decodeTimeZoneId,
  deriveReminderTrigger,
  reminderSchema,
} from '../../src/domain';

describe('reminder scheduling', () => {
  it('resolves all-day offsets and includes snooze revision in delivery identity', () => {
    const reminder = reminderSchema.parse({
      id: 'reminder:1',
      ownerKind: 'task',
      ownerId: 'task:1',
      target: 'planned',
      offsetMinutes: 15,
      scheduleRevision: 2,
      snoozeRevision: 3,
    });
    const trigger = deriveReminderTrigger(
      reminder,
      {
        plannedAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-13' }),
        deadlineAt: { kind: 'none' },
      },
      decodeLocalTime('09:00'),
      decodeTimeZoneId('Asia/Shanghai'),
    );
    expect(trigger?.triggerInstant).toBe('2026-08-13T00:45:00Z');
    expect(trigger?.deliveryKey).toContain(':2:');
    expect(trigger?.deliveryKey.endsWith(':3')).toBe(true);
  });

  it('uses compatible DST semantics for nonexistent and repeated wall times', () => {
    const reminder = reminderSchema.parse({
      id: 'reminder:dst',
      ownerKind: 'task',
      ownerId: 'task:dst',
      target: 'planned',
      offsetMinutes: 0,
      scheduleRevision: 0,
      snoozeRevision: 0,
    });
    const zone = decodeTimeZoneId('America/New_York');
    expect(
      deriveReminderTrigger(
        reminder,
        {
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-03-08T02:30',
          }),
          deadlineAt: { kind: 'none' },
        },
        decodeLocalTime('09:00'),
        zone,
      )?.triggerInstant,
    ).toBe('2026-03-08T07:30:00Z');
    expect(
      deriveReminderTrigger(
        reminder,
        {
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-11-01T01:30',
          }),
          deadlineAt: { kind: 'none' },
        },
        decodeLocalTime('09:00'),
        zone,
      )?.triggerInstant,
    ).toBe('2026-11-01T05:30:00Z');
  });
});
