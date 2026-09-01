import { Temporal } from 'temporal-polyfill';

import {
  combineLocalDateAndTime,
  instantSchema,
  localDateSchema,
  localDateTimeSchema,
  localDateTimeToInstant,
  schedulePointLocalDate,
  type Instant,
  type LocalTime,
  type SchedulePoint,
  type ScheduledPoint,
  type TimeZoneId,
} from '../schedule/time';
import type { OccurrenceRecord, RecurrenceSeries } from '../recurrence/model';
import type { Reminder } from './model';
import { reminderSchema } from './model';

export interface ReminderSchedule {
  readonly plannedAt: SchedulePoint;
  readonly deadlineAt: SchedulePoint;
}

export interface ResolvedReminderTrigger {
  readonly targetPoint: ScheduledPoint;
  /** The plan/deadline instant before applying the reminder offset. */
  readonly targetInstant: Instant;
  /** The effective notification instant after offset or snooze. */
  readonly triggerInstant: Instant;
  readonly deliveryKey: string;
  readonly snoozed: boolean;
}

function schedulePointToInstant(
  point: ScheduledPoint,
  allDayDefaultTime: LocalTime,
  timeZone: TimeZoneId,
): Instant {
  const localDateTime =
    point.kind === 'allDay'
      ? combineLocalDateAndTime(point.date, allDayDefaultTime)
      : point.localDateTime;
  return localDateTimeToInstant(localDateTime, timeZone);
}

export function createReminderDeliveryKey(
  reminder: Reminder,
  triggerInstant: Instant,
): string {
  return [
    'reminder-delivery:v1',
    encodeURIComponent(reminder.id),
    String(reminder.scheduleRevision),
    encodeURIComponent(triggerInstant),
    String(reminder.snoozeRevision),
  ].join(':');
}

/** Schedule-affecting edits invalidate a previous snooze and delivery identity. */
export function reviseReminderSchedule(reminder: Reminder): Reminder {
  const { snoozedUntil: _snoozedUntil, ...withoutSnooze } = reminder;
  void _snoozedUntil;
  return reminderSchema.parse({
    ...withoutSnooze,
    scheduleRevision: reminder.scheduleRevision + 1,
  });
}

/**
 * Resolve one notification without copying schedule data into the reminder.
 * A snooze replaces only the notification instant, never the plan/deadline.
 */
export function deriveReminderTrigger(
  reminder: Reminder,
  schedule: ReminderSchedule,
  allDayDefaultTime: LocalTime,
  timeZone: TimeZoneId,
): ResolvedReminderTrigger | undefined {
  const targetPoint =
    reminder.target === 'planned' ? schedule.plannedAt : schedule.deadlineAt;
  if (targetPoint.kind === 'none') {
    return undefined;
  }

  const targetInstant = schedulePointToInstant(targetPoint, allDayDefaultTime, timeZone);
  const regularTrigger = instantSchema.parse(
    Temporal.Instant.from(targetInstant)
      .subtract({ minutes: reminder.offsetMinutes })
      .toString(),
  );
  const triggerInstant = reminder.snoozedUntil ?? regularTrigger;

  return {
    targetPoint,
    targetInstant,
    triggerInstant,
    deliveryKey: createReminderDeliveryKey(reminder, triggerInstant),
    snoozed: reminder.snoozedUntil !== undefined,
  };
}

function shiftPointFromAnchor(
  point: SchedulePoint,
  templateAnchor: ScheduledPoint,
  occurrenceAnchor: ScheduledPoint,
): SchedulePoint {
  if (point.kind === 'none') {
    return point;
  }

  const pointDate = schedulePointLocalDate(point);
  const templateDate = schedulePointLocalDate(templateAnchor);
  const occurrenceDate = schedulePointLocalDate(occurrenceAnchor);
  if (
    pointDate === undefined ||
    templateDate === undefined ||
    occurrenceDate === undefined
  ) {
    return point;
  }

  const dayOffset = Temporal.PlainDate.from(templateDate).until(pointDate).days;
  const shiftedDate = Temporal.PlainDate.from(occurrenceDate)
    .add({ days: dayOffset })
    .toString();

  if (point.kind === 'allDay') {
    return { kind: 'allDay', date: localDateSchema.parse(shiftedDate) };
  }

  return {
    kind: 'timed',
    localDateTime: localDateTimeSchema.parse(
      `${shiftedDate}T${point.localDateTime.slice(11)}`,
    ),
  };
}

export interface OccurrenceScheduleOverrides {
  readonly plannedAt?: SchedulePoint;
  readonly deadlineAt?: SchedulePoint;
}

/** Project any occurrence schedule while preserving local day and wall-time offsets. */
export function projectOccurrenceSchedule(
  series: RecurrenceSeries,
  originalAnchor: ScheduledPoint,
  overrides: OccurrenceScheduleOverrides = {},
): ReminderSchedule {
  const templateAnchor =
    series.anchor === 'planned' ? series.template.plannedAt : series.template.deadlineAt;
  if (templateAnchor.kind === 'none') {
    throw new TypeError('A recurrence series must have a scheduled template anchor.');
  }
  return {
    plannedAt:
      overrides.plannedAt ??
      shiftPointFromAnchor(series.template.plannedAt, templateAnchor, originalAnchor),
    deadlineAt:
      overrides.deadlineAt ??
      shiftPointFromAnchor(series.template.deadlineAt, templateAnchor, originalAnchor),
  };
}

/**
 * Project the current materialized occurrence while preserving the template's
 * local calendar-day and wall-time relationship. Recurrence expansion remains
 * owned by the recurrence projector in Phase 4.
 */
export function projectActiveOccurrenceSchedule(
  series: RecurrenceSeries,
  occurrence: OccurrenceRecord,
): ReminderSchedule | undefined {
  if (
    series.status !== 'active' ||
    occurrence.state !== 'pending' ||
    series.activeOccurrenceKey !== occurrence.occurrenceKey
  ) {
    return undefined;
  }

  return projectOccurrenceSchedule(series, occurrence.originalAnchor, {
    ...(occurrence.overridePlannedAt !== undefined
      ? { plannedAt: occurrence.overridePlannedAt }
      : {}),
    ...(occurrence.overrideDeadlineAt !== undefined
      ? { deadlineAt: occurrence.overrideDeadlineAt }
      : {}),
  });
}
