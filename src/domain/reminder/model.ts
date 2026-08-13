import { z } from 'zod';

import { instantSchema } from '../schedule/time';

const nonEmptyIdSchema = z.string().min(1);

export const reminderOwnerKindSchema = z.enum(['task', 'series']);
export type ReminderOwnerKind = z.infer<typeof reminderOwnerKindSchema>;

export const reminderTargetSchema = z.enum(['planned', 'deadline']);
export type ReminderTarget = z.infer<typeof reminderTargetSchema>;

export const reminderSchema = z
  .object({
    id: nonEmptyIdSchema,
    ownerKind: reminderOwnerKindSchema,
    ownerId: nonEmptyIdSchema,
    target: reminderTargetSchema,
    /** Non-negative minutes before the referenced plan or deadline. */
    offsetMinutes: z.number().int().nonnegative(),
    scheduleRevision: z.number().int().nonnegative(),
    /** Changes on every snooze, even when the chosen instant is unchanged. */
    snoozeRevision: z.number().int().nonnegative().default(0),
    lastDeliveryKey: z.string().min(1).optional(),
    snoozedUntil: instantSchema.optional(),
  })
  .strict();

export type Reminder = z.infer<typeof reminderSchema>;

export function decodeReminder(input: unknown): Reminder {
  return reminderSchema.parse(input);
}
