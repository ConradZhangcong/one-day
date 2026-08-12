import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { occurrenceKeySchema, tryParseOccurrenceKey } from './occurrence-key';
import {
  instantSchema,
  localDateSchema,
  schedulePointSchema,
  scheduledPointSchema,
} from '../schedule/time';
import { taskDetailsSchema } from '../task/model';

const nonEmptyIdSchema = z.string().min(1);

export const recurrenceEndSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('never') }).strict(),
  z
    .object({
      kind: z.literal('date'),
      inclusive: localDateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('count'),
      count: z.number().int().positive(),
    })
    .strict(),
]);

export type RecurrenceEnd = z.infer<typeof recurrenceEndSchema>;

const recurrenceBaseShape = {
  interval: z.number().int().positive(),
  end: recurrenceEndSchema.optional(),
} as const;

const weekdaySchema = z.number().int().min(1).max(7);

const weekdaysSchema = z
  .array(weekdaySchema)
  .min(1)
  .max(7)
  .refine(
    (weekdays) => new Set(weekdays).size === weekdays.length,
    'Weekdays must be unique.',
  );

export const fixedRecurrenceRuleSchema = z.discriminatedUnion('frequency', [
  z
    .object({
      frequency: z.literal('daily'),
      ...recurrenceBaseShape,
    })
    .strict(),
  z
    .object({
      frequency: z.literal('weekly'),
      ...recurrenceBaseShape,
      weekdays: weekdaysSchema,
    })
    .strict(),
  z
    .object({
      frequency: z.literal('monthly'),
      ...recurrenceBaseShape,
      monthMode: z.enum(['sameDay', 'lastDay']),
    })
    .strict(),
  z
    .object({
      frequency: z.literal('yearly'),
      ...recurrenceBaseShape,
    })
    .strict(),
]);

export type FixedRecurrenceRule = z.infer<typeof fixedRecurrenceRuleSchema>;

export const taskTemplateSchema = taskDetailsSchema;
export type TaskTemplate = z.infer<typeof taskTemplateSchema>;

export const taskSnapshotSchema = taskDetailsSchema
  .extend({ capturedAt: instantSchema })
  .strict();
export type TaskSnapshot = z.infer<typeof taskSnapshotSchema>;

export const recurrenceSeriesStatusSchema = z.enum([
  'active',
  'paused',
  'ended',
  'archived',
]);
export type RecurrenceSeriesStatus = z.infer<
  typeof recurrenceSeriesStatusSchema
>;

export const recurrenceSeriesSchema = z
  .object({
    id: nonEmptyIdSchema,
    template: taskTemplateSchema,
    anchor: z.enum(['planned', 'deadline']),
    rule: fixedRecurrenceRuleSchema,
    status: recurrenceSeriesStatusSchema,
    activeOccurrenceKey: occurrenceKeySchema.optional(),
    revision: z.number().int().positive(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict()
  .superRefine((series, context) => {
    const anchorPoint =
      series.anchor === 'planned'
        ? series.template.plannedAt
        : series.template.deadlineAt;

    if (anchorPoint.kind === 'none') {
      context.addIssue({
        code: 'custom',
        message: 'A recurrence anchor must reference a scheduled point.',
        path: ['template', `${series.anchor}At`],
      });
    }

    const mustHaveActiveOccurrence =
      series.status === 'active' || series.status === 'paused';
    if (mustHaveActiveOccurrence !== (series.activeOccurrenceKey !== undefined)) {
      context.addIssue({
        code: 'custom',
        message:
          'Active and paused series require an active occurrence; terminal series forbid one.',
        path: ['activeOccurrenceKey'],
      });
    }

    if (series.activeOccurrenceKey !== undefined) {
      const identity = tryParseOccurrenceKey(series.activeOccurrenceKey);
      if (
        identity === undefined ||
        identity.seriesId !== series.id ||
        identity.revision !== series.revision
      ) {
        context.addIssue({
          code: 'custom',
          message: 'The active occurrence key must belong to this series revision.',
          path: ['activeOccurrenceKey'],
        });
      }
    }

    if (Temporal.Instant.compare(series.updatedAt, series.createdAt) < 0) {
      context.addIssue({
        code: 'custom',
        message: 'updatedAt cannot be earlier than createdAt.',
        path: ['updatedAt'],
      });
    }
  });

export type RecurrenceSeries = z.infer<typeof recurrenceSeriesSchema>;

const occurrenceBaseShape = {
  occurrenceKey: occurrenceKeySchema,
  seriesId: nonEmptyIdSchema,
  originalAnchor: scheduledPointSchema,
  overridePlannedAt: schedulePointSchema.optional(),
  overrideDeadlineAt: schedulePointSchema.optional(),
  templateSnapshot: taskSnapshotSchema.optional(),
} as const;

const pendingOccurrenceSchema = z
  .object({
    ...occurrenceBaseShape,
    state: z.literal('pending'),
    completedAt: z.never().optional(),
    skippedAt: z.never().optional(),
  })
  .strict();

const completedOccurrenceSchema = z
  .object({
    ...occurrenceBaseShape,
    state: z.literal('completed'),
    completedAt: instantSchema,
    skippedAt: z.never().optional(),
  })
  .strict();

const skippedOccurrenceSchema = z
  .object({
    ...occurrenceBaseShape,
    state: z.literal('skipped'),
    completedAt: z.never().optional(),
    skippedAt: instantSchema,
  })
  .strict();

function sameAnchor(
  left: z.infer<typeof scheduledPointSchema>,
  right: z.infer<typeof scheduledPointSchema>,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'allDay') {
    return right.kind === 'allDay' && left.date === right.date;
  }

  return (
    right.kind === 'timed' && left.localDateTime === right.localDateTime
  );
}

export const occurrenceRecordSchema = z
  .discriminatedUnion('state', [
    pendingOccurrenceSchema,
    completedOccurrenceSchema,
    skippedOccurrenceSchema,
  ])
  .superRefine((record, context) => {
    const identity = tryParseOccurrenceKey(record.occurrenceKey);
    if (
      identity === undefined ||
      identity.seriesId !== record.seriesId ||
      !sameAnchor(identity.originalAnchor, record.originalAnchor)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The occurrence key must identify this series and original anchor.',
        path: ['occurrenceKey'],
      });
    }
  });

export type OccurrenceRecord = z.infer<typeof occurrenceRecordSchema>;

export function decodeFixedRecurrenceRule(input: unknown): FixedRecurrenceRule {
  return fixedRecurrenceRuleSchema.parse(input);
}

export function decodeTaskTemplate(input: unknown): TaskTemplate {
  return taskTemplateSchema.parse(input);
}

export function decodeRecurrenceSeries(input: unknown): RecurrenceSeries {
  return recurrenceSeriesSchema.parse(input);
}

export function decodeOccurrenceRecord(input: unknown): OccurrenceRecord {
  return occurrenceRecordSchema.parse(input);
}
