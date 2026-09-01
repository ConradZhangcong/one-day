import { Temporal } from 'temporal-polyfill';

import { DomainError, DomainErrorCode } from '../errors';
import {
  localDateSchema,
  localDateTimeSchema,
  scheduledPointSchema,
  type ScheduledPoint,
} from '../schedule/time';
import { createOccurrenceKey, type OccurrenceKey } from './occurrence-key';
import {
  decodeFixedRecurrenceRule,
  type FixedRecurrenceRule,
  type RecurrenceSeries,
} from './model';

export const MAX_RECURRENCE_EXPANSION = 1_000;
const MAX_GENERATION_STEPS = 100_000;

export interface ProjectedOccurrenceIdentity {
  readonly occurrenceKey: OccurrenceKey;
  readonly originalAnchor: ScheduledPoint;
  readonly ordinal: number;
}

export interface ProjectOccurrenceRangeInput {
  readonly seriesId: string;
  readonly revision: number;
  readonly anchor: ScheduledPoint;
  readonly rule: FixedRecurrenceRule;
  readonly rangeStart?: ScheduledPoint;
  readonly rangeEnd?: ScheduledPoint;
  readonly limit: number;
}

function pointValue(point: ScheduledPoint): string {
  return point.kind === 'allDay' ? point.date : point.localDateTime;
}

function pointDate(point: ScheduledPoint): string {
  return point.kind === 'allDay' ? point.date : point.localDateTime.slice(0, 10);
}

function comparePoints(left: ScheduledPoint, right: ScheduledPoint): number {
  if (left.kind !== right.kind) {
    throw new DomainError(
      DomainErrorCode.INVALID_RECURRENCE_RANGE,
      'A recurrence range must use the same schedule kind as its anchor.',
    );
  }
  return pointValue(left).localeCompare(pointValue(right));
}

function withDate(anchor: ScheduledPoint, date: Temporal.PlainDate): ScheduledPoint {
  const dateText = date.toString();
  if (anchor.kind === 'allDay') {
    return { kind: 'allDay', date: localDateSchema.parse(dateText) };
  }
  return {
    kind: 'timed',
    localDateTime: localDateTimeSchema.parse(
      `${dateText}T${anchor.localDateTime.slice(11)}`,
    ),
  };
}

function tryDate(
  year: number,
  month: number,
  day: number,
): Temporal.PlainDate | undefined {
  try {
    return Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' });
  } catch {
    return undefined;
  }
}

function* candidateDates(
  anchor: ScheduledPoint,
  rule: FixedRecurrenceRule,
): Generator<Temporal.PlainDate> {
  const start = Temporal.PlainDate.from(pointDate(anchor));
  switch (rule.frequency) {
    case 'daily':
      for (let step = 0; ; step += 1) {
        yield start.add({ days: step * rule.interval });
      }
    case 'weekly': {
      if (!rule.weekdays.includes(start.dayOfWeek)) {
        throw new DomainError(
          DomainErrorCode.INVALID_RECURRENCE,
          'The first occurrence weekday must be included in a weekly rule.',
        );
      }
      const weekdays = [...rule.weekdays].sort((left, right) => left - right);
      const firstMonday = start.subtract({ days: start.dayOfWeek - 1 });
      for (let week = 0; ; week += 1) {
        const monday = firstMonday.add({ weeks: week * rule.interval });
        for (const weekday of weekdays) {
          const candidate = monday.add({ days: weekday - 1 });
          if (Temporal.PlainDate.compare(candidate, start) >= 0) yield candidate;
        }
      }
    }
    case 'monthly':
      for (let month = 0; ; month += 1) {
        const base = start.with({ day: 1 }).add({ months: month * rule.interval });
        if (rule.monthMode === 'lastDay') {
          yield base.with({ day: base.daysInMonth });
        } else {
          const candidate = tryDate(base.year, base.month, start.day);
          if (candidate !== undefined) yield candidate;
        }
      }
    case 'yearly':
      for (let year = 0; ; year += 1) {
        const candidate = tryDate(
          start.year + year * rule.interval,
          start.month,
          start.day,
        );
        if (candidate !== undefined) yield candidate;
      }
  }
}

function assertInput(input: ProjectOccurrenceRangeInput): FixedRecurrenceRule {
  const rule = decodeFixedRecurrenceRule(input.rule);
  scheduledPointSchema.parse(input.anchor);
  if (
    input.seriesId.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 1 ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > MAX_RECURRENCE_EXPANSION
  ) {
    throw new DomainError(
      DomainErrorCode.RECURRENCE_LIMIT_EXCEEDED,
      `Recurrence limit must be between 1 and ${MAX_RECURRENCE_EXPANSION}.`,
    );
  }
  if (input.rangeStart !== undefined) comparePoints(input.rangeStart, input.anchor);
  if (input.rangeEnd !== undefined) comparePoints(input.rangeEnd, input.anchor);
  if (
    input.rangeStart !== undefined &&
    input.rangeEnd !== undefined &&
    comparePoints(input.rangeStart, input.rangeEnd) > 0
  ) {
    throw new DomainError(
      DomainErrorCode.INVALID_RECURRENCE_RANGE,
      'Recurrence range end cannot be earlier than its start.',
    );
  }
  return rule;
}

/** Expand a fixed recurrence without changing phase or COUNT at range boundaries. */
export function projectOccurrenceRange(
  input: ProjectOccurrenceRangeInput,
): ProjectedOccurrenceIdentity[] {
  const rule = assertInput(input);
  const result: ProjectedOccurrenceIdentity[] = [];
  let ordinal = 0;
  let steps = 0;

  for (const date of candidateDates(input.anchor, rule)) {
    steps += 1;
    if (steps > MAX_GENERATION_STEPS) {
      throw new DomainError(
        DomainErrorCode.RECURRENCE_LIMIT_EXCEEDED,
        'The requested recurrence range is too expensive to expand.',
      );
    }
    ordinal += 1;
    if (rule.end?.kind === 'count' && ordinal > rule.end.count) break;
    const occurrence = withDate(input.anchor, date);
    if (
      rule.end?.kind === 'date' &&
      pointDate(occurrence).localeCompare(rule.end.inclusive) > 0
    ) {
      break;
    }
    if (input.rangeEnd !== undefined && comparePoints(occurrence, input.rangeEnd) >= 0) {
      break;
    }
    if (
      input.rangeStart !== undefined &&
      comparePoints(occurrence, input.rangeStart) < 0
    ) {
      continue;
    }
    result.push({
      occurrenceKey: createOccurrenceKey(input.seriesId, input.revision, occurrence),
      originalAnchor: occurrence,
      ordinal,
    });
    if (result.length === input.limit) break;
  }
  return result;
}

export function nextOccurrenceAfter(input: {
  readonly series: RecurrenceSeries;
  readonly after: ScheduledPoint;
}): ProjectedOccurrenceIdentity | undefined {
  const templateAnchor =
    input.series.anchor === 'planned'
      ? input.series.template.plannedAt
      : input.series.template.deadlineAt;
  if (templateAnchor.kind === 'none') {
    throw new DomainError(
      DomainErrorCode.RECURRENCE_ANCHOR_MISSING,
      'The recurrence series has no scheduled anchor.',
    );
  }
  return projectOccurrenceRange({
    seriesId: input.series.id,
    revision: input.series.revision,
    anchor: templateAnchor,
    rule: input.series.rule,
    rangeStart: input.after,
    limit: 2,
  }).find((item) => comparePoints(item.originalAnchor, input.after) > 0);
}

export function compareScheduledPoints(
  left: ScheduledPoint,
  right: ScheduledPoint,
): number {
  return comparePoints(left, right);
}
