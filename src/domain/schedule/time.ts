import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const OFFSET_TIME_ZONE_PATTERN = /^(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

function isValidLocalDateTime(value: string): boolean {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDateTime.from(value);
    return true;
  } catch {
    return false;
  }
}

function isValidInstant(value: string): boolean {
  if (!UTC_INSTANT_PATTERN.test(value)) {
    return false;
  }

  try {
    Temporal.Instant.from(value);
    return true;
  } catch {
    return false;
  }
}

function isValidTimeZoneId(value: string): boolean {
  if (value.length === 0 || OFFSET_TIME_ZONE_PATTERN.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDateTime.from('2000-01-01T00:00').toZonedDateTime(value);
    return true;
  } catch {
    return false;
  }
}

export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, 'Expected a valid YYYY-MM-DD local date.')
  .brand<'LocalDate'>();

export type LocalDate = z.infer<typeof localDateSchema>;

export const localDateTimeSchema = z
  .string()
  .refine(
    isValidLocalDateTime,
    'Expected a valid YYYY-MM-DDTHH:mm local date-time.',
  )
  .brand<'LocalDateTime'>();

export type LocalDateTime = z.infer<typeof localDateTimeSchema>;

export const instantSchema = z
  .string()
  .refine(isValidInstant, 'Expected a valid UTC ISO instant ending in Z.')
  .brand<'Instant'>();

export type Instant = z.infer<typeof instantSchema>;

/** Compatibility alias used by the design documents. */
export type InstantString = Instant;
export const instantStringSchema = instantSchema;

export const timeZoneIdSchema = z
  .string()
  .refine(isValidTimeZoneId, 'Expected a valid named IANA time-zone identifier.')
  .brand<'TimeZoneId'>();

export type TimeZoneId = z.infer<typeof timeZoneIdSchema>;

export const noSchedulePointSchema = z.object({ kind: z.literal('none') }).strict();

export const allDaySchedulePointSchema = z
  .object({
    kind: z.literal('allDay'),
    date: localDateSchema,
  })
  .strict();

export const timedSchedulePointSchema = z
  .object({
    kind: z.literal('timed'),
    localDateTime: localDateTimeSchema,
  })
  .strict();

export const schedulePointSchema = z.discriminatedUnion('kind', [
  noSchedulePointSchema,
  allDaySchedulePointSchema,
  timedSchedulePointSchema,
]);

export type SchedulePoint = z.infer<typeof schedulePointSchema>;
export type ScheduledPoint = Exclude<SchedulePoint, { kind: 'none' }>;

export const scheduledPointSchema = z.discriminatedUnion('kind', [
  allDaySchedulePointSchema,
  timedSchedulePointSchema,
]);

export function decodeLocalDate(input: unknown): LocalDate {
  return localDateSchema.parse(input);
}

export function decodeLocalDateTime(input: unknown): LocalDateTime {
  return localDateTimeSchema.parse(input);
}

export function decodeInstant(input: unknown): Instant {
  return instantSchema.parse(input);
}

export function decodeTimeZoneId(input: unknown): TimeZoneId {
  return timeZoneIdSchema.parse(input);
}

export function decodeSchedulePoint(input: unknown): SchedulePoint {
  return schedulePointSchema.parse(input);
}

export function localDateTimeToInstant(
  localDateTime: LocalDateTime,
  timeZone: TimeZoneId,
): Instant {
  const value = Temporal.PlainDateTime.from(localDateTime)
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
    .toInstant()
    .toString();

  return instantSchema.parse(value);
}

export function instantToLocalDate(
  instant: Instant,
  timeZone: TimeZoneId,
): LocalDate {
  const value = Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();

  return localDateSchema.parse(value);
}

export function schedulePointLocalDate(
  point: SchedulePoint,
): LocalDate | undefined {
  switch (point.kind) {
    case 'none':
      return undefined;
    case 'allDay':
      return point.date;
    case 'timed':
      return localDateSchema.parse(point.localDateTime.slice(0, 10));
  }
}

export function compareLocalDates(left: LocalDate, right: LocalDate): number {
  return Temporal.PlainDate.compare(left, right);
}

export function compareInstants(left: Instant, right: Instant): number {
  return Temporal.Instant.compare(left, right);
}
