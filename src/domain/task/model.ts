import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { instantSchema, schedulePointSchema } from '../schedule/time';

const nonEmptyIdSchema = z.string().min(1);
const uniqueIdsSchema = z
  .array(nonEmptyIdSchema)
  .refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique.');

export const prioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export type Priority = z.infer<typeof prioritySchema>;

const taskOrganizationShape = {
  title: z.string().trim().min(1),
  notes: z.string(),
  listId: nonEmptyIdSchema,
  tagIds: uniqueIdsSchema,
  priority: prioritySchema,
  plannedAt: schedulePointSchema,
  deadlineAt: schedulePointSchema,
} as const;

export const taskDraftSchema = z
  .object({
    title: taskOrganizationShape.title,
    notes: taskOrganizationShape.notes,
    listId: taskOrganizationShape.listId,
    tagNames: z.array(z.string().trim().min(1)),
    priority: taskOrganizationShape.priority,
    plannedAt: taskOrganizationShape.plannedAt,
    deadlineAt: taskOrganizationShape.deadlineAt,
  })
  .strict();

type ParsedTaskDraft = z.infer<typeof taskDraftSchema>;
export type TaskDraft = Omit<ParsedTaskDraft, 'tagNames'> & {
  readonly tagNames: readonly string[];
};

export function decodeTaskDraft(input: unknown): TaskDraft {
  return taskDraftSchema.parse(input);
}

export const taskDetailsSchema = z.object(taskOrganizationShape).strict();
export type TaskDetails = z.infer<typeof taskDetailsSchema>;

const taskAuditShape = {
  createdAt: instantSchema,
  updatedAt: instantSchema,
} as const;

const pendingTaskSchema = z
  .object({
    id: nonEmptyIdSchema,
    ...taskOrganizationShape,
    state: z.literal('pending'),
    completedAt: z.never().optional(),
    skippedAt: z.never().optional(),
    ...taskAuditShape,
  })
  .strict();

const completedTaskSchema = z
  .object({
    id: nonEmptyIdSchema,
    ...taskOrganizationShape,
    state: z.literal('completed'),
    completedAt: instantSchema,
    skippedAt: z.never().optional(),
    ...taskAuditShape,
  })
  .strict();

const skippedTaskSchema = z
  .object({
    id: nonEmptyIdSchema,
    ...taskOrganizationShape,
    state: z.literal('skipped'),
    completedAt: z.never().optional(),
    skippedAt: instantSchema,
    ...taskAuditShape,
  })
  .strict();

export const singleTaskSchema = z
  .discriminatedUnion('state', [
    pendingTaskSchema,
    completedTaskSchema,
    skippedTaskSchema,
  ])
  .superRefine((task, context) => {
    if (Temporal.Instant.compare(task.updatedAt, task.createdAt) < 0) {
      context.addIssue({
        code: 'custom',
        message: 'updatedAt cannot be earlier than createdAt.',
        path: ['updatedAt'],
      });
    }
  });

export type SingleTask = z.infer<typeof singleTaskSchema>;

export function decodeSingleTask(input: unknown): SingleTask {
  return singleTaskSchema.parse(input);
}

export const taskListSchema = z
  .object({
    id: nonEmptyIdSchema,
    name: z.string().trim().min(1),
    order: z.number().int().nonnegative(),
    archived: z.boolean(),
    isSystem: z.boolean(),
  })
  .strict()
  .superRefine((list, context) => {
    if (list.isSystem && list.archived) {
      context.addIssue({
        code: 'custom',
        message: 'A system list cannot be archived.',
        path: ['archived'],
      });
    }
  });

export type TaskList = z.infer<typeof taskListSchema>;
/** Avoid shadowing the JavaScript List concept internally while supporting the PRD name. */
export type List = TaskList;
export const listSchema = taskListSchema;

export function decodeTaskList(input: unknown): TaskList {
  return taskListSchema.parse(input);
}

export const tagSchema = z
  .object({
    id: nonEmptyIdSchema,
    name: z.string().trim().min(1),
    color: z.string().trim().min(1),
  })
  .strict();

export type Tag = z.infer<typeof tagSchema>;

export function decodeTag(input: unknown): Tag {
  return tagSchema.parse(input);
}
