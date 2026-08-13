import { z } from 'zod';

import { DomainError, DomainErrorCode } from '../errors';
import {
  compareInstants,
  compareLocalDates,
  localDateTimeToInstant,
  schedulePointLocalDate,
  schedulePointSchema,
  type SchedulePoint,
  type TimeZoneId,
} from './time';

export const schedulePairSchema = z
  .object({
    plannedAt: schedulePointSchema,
    deadlineAt: schedulePointSchema,
  })
  .strict();

export type SchedulePair = z.infer<typeof schedulePairSchema>;

export type ScheduleValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly error: DomainError };

/**
 * Validate the business ordering of independent plan and deadline values.
 * Mixed all-day/timed values compare their local calendar dates; two timed
 * values compare resolved instants in the application's configured time zone.
 */
export function validateScheduleOrder(
  plannedAt: SchedulePoint,
  deadlineAt: SchedulePoint,
  timeZone: TimeZoneId,
): ScheduleValidationResult {
  if (plannedAt.kind === 'none' || deadlineAt.kind === 'none') {
    return { ok: true };
  }

  let deadlineBeforePlan: boolean;

  if (plannedAt.kind === 'timed' && deadlineAt.kind === 'timed') {
    deadlineBeforePlan =
      compareInstants(
        localDateTimeToInstant(deadlineAt.localDateTime, timeZone),
        localDateTimeToInstant(plannedAt.localDateTime, timeZone),
      ) < 0;
  } else {
    const plannedDate = schedulePointLocalDate(plannedAt);
    const deadlineDate = schedulePointLocalDate(deadlineAt);

    // Both values are non-none, so both local dates are defined.
    deadlineBeforePlan =
      plannedDate !== undefined &&
      deadlineDate !== undefined &&
      compareLocalDates(deadlineDate, plannedDate) < 0;
  }

  if (!deadlineBeforePlan) {
    return { ok: true };
  }

  return {
    ok: false,
    error: new DomainError(
      DomainErrorCode.DEADLINE_BEFORE_PLAN,
      'The deadline cannot be earlier than the planned time.',
      { plannedAt, deadlineAt, timeZone },
    ),
  };
}

export function validateSchedulePair(
  pair: SchedulePair,
  timeZone: TimeZoneId,
): ScheduleValidationResult {
  return validateScheduleOrder(pair.plannedAt, pair.deadlineAt, timeZone);
}

export function assertValidScheduleOrder(
  plannedAt: SchedulePoint,
  deadlineAt: SchedulePoint,
  timeZone: TimeZoneId,
): void {
  const result = validateScheduleOrder(plannedAt, deadlineAt, timeZone);
  if (!result.ok) {
    throw result.error;
  }
}

export function assertValidSchedulePair(pair: SchedulePair, timeZone: TimeZoneId): void {
  assertValidScheduleOrder(pair.plannedAt, pair.deadlineAt, timeZone);
}

/** Build a Zod boundary decoder when the user time zone is known. */
export function createSchedulePairSchema(timeZone: TimeZoneId) {
  return schedulePairSchema.superRefine((pair, context) => {
    const result = validateScheduleOrder(pair.plannedAt, pair.deadlineAt, timeZone);

    if (!result.ok) {
      context.addIssue({
        code: 'custom',
        message: result.error.code,
        path: ['deadlineAt'],
      });
    }
  });
}
