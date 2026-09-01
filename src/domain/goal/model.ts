import { z } from 'zod';

import { instantSchema } from '../schedule/time';

export const longTermGoalStatusSchema = z.enum([
  'planned',
  'active',
  'completed',
  'archived',
]);
export type LongTermGoalStatus = z.infer<typeof longTermGoalStatusSchema>;

export const longTermGoalSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1),
    description: z.string(),
    status: longTermGoalStatusSchema,
    createdAt: instantSchema,
    updatedAt: instantSchema,
  })
  .strict();

export type LongTermGoal = z.infer<typeof longTermGoalSchema>;

export function decodeLongTermGoal(input: unknown): LongTermGoal {
  return longTermGoalSchema.parse(input);
}
