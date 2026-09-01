import { Temporal } from 'temporal-polyfill';

import {
  assertValidSchedulePair,
  DomainError,
  DomainErrorCode,
  decodeInstant,
  decodeTaskDraft,
  decodeTimeZoneId,
  reviseReminderSchedule,
  schedulePointSchema,
  singleTaskSchema,
  tagSchema,
  taskListSchema,
  type SingleTask,
  type Reminder,
  type SchedulePoint,
  type Tag,
  type TaskDraft as DomainTaskDraft,
  type TaskList,
  type TimeZoneId,
  type LongTermGoal,
} from '../../domain';
import type { DeleteListResult, UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';

export interface TodoSnapshot {
  readonly tasks: SingleTask[];
  readonly lists: TaskList[];
  readonly tags: Tag[];
  readonly timeZone: TimeZoneId;
  readonly goals: LongTermGoal[];
}

export type TaskDraft = DomainTaskDraft;

export interface TodoServiceDependencies {
  readonly createId?: () => string;
  readonly now?: () => string;
  readonly detectTimeZone?: () => string;
  readonly onScheduleChanged?: () => void;
}

export interface RescheduleTaskPatch {
  readonly plannedAt?: SchedulePoint;
  readonly deadlineAt?: SchedulePoint;
}

function defaultId(): string {
  return crypto.randomUUID();
}

function defaultNow(): string {
  return Temporal.Now.instant().toString();
}

function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function normalizedName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
}

const TAG_COLORS = ['green', 'blue', 'gold', 'purple', 'cyan', 'magenta'] as const;

export class TodoService {
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly detectTimeZone: () => string;
  private readonly onScheduleChanged: () => void;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    dependencies: TodoServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? defaultId;
    this.now = dependencies.now ?? defaultNow;
    this.detectTimeZone = dependencies.detectTimeZone ?? defaultTimeZone;
    this.onScheduleChanged = dependencies.onScheduleChanged ?? (() => undefined);
  }

  async snapshot(): Promise<TodoSnapshot> {
    const { lists, settings, singleTasks, tags, longTermGoals } =
      this.unitOfWork.repositories;
    const [tasks, allLists, allTags, storedTimeZone, goals] = await Promise.all([
      singleTasks.getAll(),
      lists.listInDisplayOrder({ includeArchived: true }),
      tags.getAll(),
      settings.get(APPLICATION_TIME_ZONE_KEY),
      longTermGoals.getAll(),
    ]);
    return {
      tasks,
      lists: allLists,
      tags: allTags,
      timeZone: decodeTimeZoneId(storedTimeZone ?? this.detectTimeZone()),
      goals,
    };
  }

  createList(name: string): Promise<TaskList> {
    return this.unitOfWork.write(async ({ lists }) => {
      const existing = await lists.getAll();
      const list = taskListSchema.parse({
        id: `list:${this.createId()}`,
        name,
        order: Math.max(0, ...existing.map((item) => item.order)) + 1,
        archived: false,
        isSystem: false,
      });
      await lists.save(list);
      return list;
    });
  }

  updateList(
    listId: string,
    patch: { readonly name?: string; readonly archived?: boolean },
  ): Promise<TaskList> {
    return this.unitOfWork.write(async ({ lists }) => {
      const list = await lists.get(listId);
      if (list === undefined)
        throw new DomainError(DomainErrorCode.LIST_NOT_FOUND, 'List does not exist.');
      if (list.isSystem) {
        throw new DomainError(
          DomainErrorCode.SYSTEM_LIST_IMMUTABLE,
          'The system inbox cannot be changed.',
        );
      }
      const updated = taskListSchema.parse({ ...list, ...patch });
      await lists.save(updated);
      return updated;
    });
  }

  reorderList(listId: string, direction: -1 | 1): Promise<void> {
    return this.unitOfWork.write(async ({ lists }) => {
      const ordered = (await lists.listInDisplayOrder()).filter((list) => !list.isSystem);
      const index = ordered.findIndex((list) => list.id === listId);
      const otherIndex = index + direction;
      const current = ordered[index];
      const other = ordered[otherIndex];
      if (current === undefined || other === undefined) return;
      await lists.saveMany([
        taskListSchema.parse({ ...current, order: other.order }),
        taskListSchema.parse({ ...other, order: current.order }),
      ]);
    });
  }

  deleteList(listId: string): Promise<DeleteListResult> {
    return this.unitOfWork.repositories.lists.deleteAndMoveContentsToInbox(listId);
  }

  createTask(draft: TaskDraft): Promise<SingleTask> {
    return this.unitOfWork.write(async (repositories) => {
      const decoded = decodeTaskDraft(draft);
      const [storedTimeZone, list, existingTags, goal] = await Promise.all([
        repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
        repositories.lists.get(decoded.listId),
        repositories.tags.getAll(),
        decoded.goalId === undefined
          ? undefined
          : repositories.longTermGoals.get(decoded.goalId),
      ]);
      const timeZone = this.resolveTimeZone(storedTimeZone);
      assertValidSchedulePair(decoded, timeZone);
      this.assertListCanOwnTask(list);
      this.assertGoalCanOwnTask(goal, decoded.goalId);
      const instant = decodeInstant(this.now());
      const { tagNames: _tagNames, ...details } = decoded;
      void _tagNames;
      const baseTask = singleTaskSchema.parse({
        id: `task:${this.createId()}`,
        ...details,
        tagIds: [],
        state: 'pending',
        createdAt: instant,
        updatedAt: instant,
      });
      const preparedTags = this.prepareTags(existingTags, decoded.tagNames);
      if (preparedTags.created.length > 0) {
        await repositories.tags.saveMany(preparedTags.created);
      }
      const task: SingleTask = { ...baseTask, tagIds: preparedTags.ids };
      await repositories.singleTasks.save(task);
      return task;
    });
  }

  async updateTask(taskId: string, draft: TaskDraft): Promise<SingleTask> {
    const result = await this.unitOfWork.write(async (repositories) => {
      const decoded = decodeTaskDraft(draft);
      const [existing, storedTimeZone, list, existingTags, goal] = await Promise.all([
        repositories.singleTasks.get(taskId),
        repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
        repositories.lists.get(decoded.listId),
        repositories.tags.getAll(),
        decoded.goalId === undefined
          ? undefined
          : repositories.longTermGoals.get(decoded.goalId),
      ]);
      if (existing === undefined)
        throw new DomainError(DomainErrorCode.TASK_NOT_FOUND, 'Task does not exist.');
      const timeZone = this.resolveTimeZone(storedTimeZone);
      assertValidSchedulePair(decoded, timeZone);
      this.assertListCanOwnTask(list, existing.listId);
      this.assertGoalCanOwnTask(goal, decoded.goalId, existing.goalId);
      const { tagNames: _tagNames, ...details } = decoded;
      void _tagNames;
      const { goalId: _existingGoalId, ...existingWithoutGoal } = existing;
      void _existingGoalId;
      const baseTask = singleTaskSchema.parse({
        ...existingWithoutGoal,
        ...details,
        tagIds: [],
        updatedAt: decodeInstant(this.now()),
      });
      const preparedTags = this.prepareTags(existingTags, decoded.tagNames);
      if (preparedTags.created.length > 0) {
        await repositories.tags.saveMany(preparedTags.created);
      }
      const updated: SingleTask = { ...baseTask, tagIds: preparedTags.ids };
      const schedulingChanged =
        !sameSchedulePoint(existing.plannedAt, updated.plannedAt) ||
        !sameSchedulePoint(existing.deadlineAt, updated.deadlineAt);
      if (schedulingChanged) {
        const reminders = await repositories.reminders.findByOwner('task', taskId);
        const changes = reviseOwnedReminders(reminders, updated);
        for (const reminderId of changes.removedIds) {
          await repositories.reminders.remove(reminderId);
        }
        if (changes.retained.length > 0) {
          await repositories.reminders.saveMany(changes.retained);
        }
      }
      await repositories.singleTasks.save(updated);
      return { updated, schedulingChanged };
    });
    if (result.schedulingChanged) this.onScheduleChanged();
    return result.updated;
  }

  async setTaskState(
    taskId: string,
    state: 'completed' | 'skipped',
  ): Promise<SingleTask> {
    const updated = await this.unitOfWork.write(async ({ singleTasks }) => {
      const existing = await singleTasks.get(taskId);
      if (existing === undefined)
        throw new DomainError(DomainErrorCode.TASK_NOT_FOUND, 'Task does not exist.');
      if (existing.state !== 'pending')
        throw new DomainError(
          DomainErrorCode.TASK_ALREADY_HANDLED,
          'Task is already handled.',
        );
      const instant = decodeInstant(this.now());
      const updated = singleTaskSchema.parse(
        state === 'completed'
          ? { ...existing, state, completedAt: instant, updatedAt: instant }
          : { ...existing, state, skippedAt: instant, updatedAt: instant },
      );
      await singleTasks.save(updated);
      return updated;
    });
    this.onScheduleChanged();
    return updated;
  }

  async undoTaskCompletion(taskId: string): Promise<SingleTask> {
    const updated = await this.unitOfWork.write(async ({ singleTasks }) => {
      const existing = await singleTasks.get(taskId);
      if (existing?.state !== 'completed') {
        throw new DomainError(
          DomainErrorCode.TASK_ALREADY_HANDLED,
          'Only a completed single task can be undone.',
        );
      }
      const { completedAt: _completedAt, ...rest } = existing;
      void _completedAt;
      const updated = singleTaskSchema.parse({
        ...rest,
        state: 'pending',
        updatedAt: decodeInstant(this.now()),
      });
      await singleTasks.save(updated);
      return updated;
    });
    this.onScheduleChanged();
    return updated;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.unitOfWork.write(async ({ reminders, singleTasks }) => {
      const ownedReminders = await reminders.findByOwner('task', taskId);
      for (const reminder of ownedReminders) {
        await reminders.remove(reminder.id);
      }
      await singleTasks.remove(taskId);
    });
    this.onScheduleChanged();
  }

  async rescheduleTask(taskId: string, patch: RescheduleTaskPatch): Promise<SingleTask> {
    if (patch.plannedAt === undefined && patch.deadlineAt === undefined) {
      throw new DomainError(
        DomainErrorCode.INVALID_SCHEDULE_POINT,
        'Rescheduling requires a plan or deadline change.',
      );
    }

    const decodedPlanned =
      patch.plannedAt === undefined
        ? undefined
        : schedulePointSchema.parse(patch.plannedAt);
    const decodedDeadline =
      patch.deadlineAt === undefined
        ? undefined
        : schedulePointSchema.parse(patch.deadlineAt);
    const updated = await this.unitOfWork.write(async (repositories) => {
      const [existing, storedTimeZone] = await Promise.all([
        repositories.singleTasks.get(taskId),
        repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
      ]);
      if (existing === undefined) {
        throw new DomainError(DomainErrorCode.TASK_NOT_FOUND, 'Task does not exist.');
      }
      if (existing.state !== 'pending') {
        throw new DomainError(
          DomainErrorCode.TASK_ALREADY_HANDLED,
          'Only a pending task can be rescheduled.',
        );
      }

      const plannedAt = decodedPlanned ?? existing.plannedAt;
      const deadlineAt = decodedDeadline ?? existing.deadlineAt;
      assertValidSchedulePair(
        { plannedAt, deadlineAt },
        this.resolveTimeZone(storedTimeZone),
      );
      const result = singleTaskSchema.parse({
        ...existing,
        plannedAt,
        deadlineAt,
        updatedAt: decodeInstant(this.now()),
      });
      const schedulingChanged =
        !sameSchedulePoint(existing.plannedAt, result.plannedAt) ||
        !sameSchedulePoint(existing.deadlineAt, result.deadlineAt);
      if (schedulingChanged) {
        const reminders = await repositories.reminders.findByOwner('task', taskId);
        const changes = reviseOwnedReminders(reminders, result);
        for (const reminderId of changes.removedIds) {
          await repositories.reminders.remove(reminderId);
        }
        if (changes.retained.length > 0) {
          await repositories.reminders.saveMany(changes.retained);
        }
      }
      await repositories.singleTasks.save(result);
      return { result, schedulingChanged };
    });
    if (updated.schedulingChanged) this.onScheduleChanged();
    return updated.result;
  }

  private resolveTimeZone(storedTimeZone: unknown): TimeZoneId {
    return decodeTimeZoneId(storedTimeZone ?? this.detectTimeZone());
  }

  private assertListCanOwnTask(list: TaskList | undefined, currentListId?: string): void {
    if (list === undefined)
      throw new DomainError(DomainErrorCode.LIST_NOT_FOUND, 'List does not exist.');
    if (list.archived && list.id !== currentListId) {
      throw new DomainError(
        DomainErrorCode.ARCHIVED_LIST,
        'An archived list cannot receive a task.',
      );
    }
  }

  private assertGoalCanOwnTask(
    goal: LongTermGoal | undefined,
    goalId: string | undefined,
    currentGoalId?: string,
  ): void {
    if (goalId === undefined) return;
    if (goal === undefined) {
      throw new DomainError(DomainErrorCode.GOAL_NOT_FOUND, 'Goal does not exist.');
    }
    if (goal.status === 'archived' && goal.id !== currentGoalId) {
      throw new DomainError(
        DomainErrorCode.ARCHIVED_GOAL,
        'An archived goal cannot receive a task.',
      );
    }
  }

  private prepareTags(
    existingTags: readonly Tag[],
    names: readonly string[],
  ): { readonly ids: string[]; readonly created: Tag[] } {
    const uniqueNames = [
      ...new Map(names.map((name) => [normalizedName(name), name.trim()])).values(),
    ].filter(Boolean);
    const result: string[] = [];
    const created: Tag[] = [];
    for (const [index, name] of uniqueNames.entries()) {
      const existing = existingTags.find(
        (tag) => normalizedName(tag.name) === normalizedName(name),
      );
      if (existing !== undefined) {
        result.push(existing.id);
        continue;
      }
      const tag = tagSchema.parse({
        id: `tag:${this.createId()}`,
        name,
        color: TAG_COLORS[index % TAG_COLORS.length],
      });
      created.push(tag);
      result.push(tag.id);
    }
    return { ids: result, created };
  }
}

function reviseOwnedReminders(
  reminders: readonly Reminder[],
  schedule: Pick<SingleTask, 'plannedAt' | 'deadlineAt'>,
): {
  readonly removedIds: string[];
  readonly retained: Reminder[];
} {
  const removedIds: string[] = [];
  const retained: Reminder[] = [];
  for (const reminder of reminders) {
    const targetPoint =
      reminder.target === 'planned' ? schedule.plannedAt : schedule.deadlineAt;
    if (targetPoint.kind === 'none') removedIds.push(reminder.id);
    else retained.push(reviseReminderSchedule(reminder));
  }
  return { removedIds, retained };
}

function sameSchedulePoint(left: SchedulePoint, right: SchedulePoint): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'none') return true;
  if (left.kind === 'allDay') {
    return right.kind === 'allDay' && left.date === right.date;
  }
  return right.kind === 'timed' && left.localDateTime === right.localDateTime;
}
