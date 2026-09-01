import { Temporal } from 'temporal-polyfill';

import {
  compareLocalDates,
  decodeInstant,
  decodeTimeZoneId,
  DomainError,
  DomainErrorCode,
  deriveTaskStatus,
  instantToLocalDate,
  localDateSchema,
  occurrenceKeySchema,
  projectOccurrenceRecordSchedule,
  schedulePointLocalDate,
  singleTaskSchema,
  tryParseOccurrenceKey,
  type DerivedTaskStatus,
  type Instant,
  type LocalDate,
  type SchedulePoint,
  type SingleTask,
  type TimeZoneId,
} from '../../domain';
import type { UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';
import type { RescheduleTaskPatch, TodoService } from '../todos';
import type { RecurrenceService } from '../recurrence';

export interface RecoveryTaskView {
  readonly task: SingleTask;
  readonly status: DerivedTaskStatus;
}

export interface RecoverySnapshot {
  readonly timeZone: TimeZoneId;
  readonly asOf: Instant;
  readonly today: LocalDate;
  readonly todayItems: RecoveryTaskView[];
  readonly missedPlanItems: RecoveryTaskView[];
  readonly overdueItems: RecoveryTaskView[];
}

export interface ReviewBucket {
  readonly count: number;
  readonly items: RecoveryTaskView[];
}

export interface ReviewSnapshot {
  readonly period: 'day' | 'week';
  readonly timeZone: TimeZoneId;
  readonly asOf: Instant;
  readonly startDate: LocalDate;
  readonly endDateExclusive: LocalDate;
  readonly completed: ReviewBucket;
  readonly skipped: ReviewBucket;
  readonly missedPlan: ReviewBucket;
  readonly overdue: ReviewBucket;
}

export interface ReviewQuery {
  readonly period: 'day' | 'week';
  readonly anchorDate?: LocalDate;
}

export interface RecoveryServiceDependencies {
  readonly now?: () => string;
  readonly detectTimeZone?: () => string;
}

function defaultNow(): string {
  return Temporal.Now.instant().toString();
}

function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function taskView(
  task: SingleTask,
  now: Instant,
  timeZone: TimeZoneId,
): RecoveryTaskView {
  return { task, status: deriveTaskStatus(task, now, timeZone) };
}

function viewSort(left: RecoveryTaskView, right: RecoveryTaskView): number {
  const leftDate =
    schedulePointLocalDate(left.task.deadlineAt) ??
    schedulePointLocalDate(left.task.plannedAt) ??
    '9999-12-31';
  const rightDate =
    schedulePointLocalDate(right.task.deadlineAt) ??
    schedulePointLocalDate(right.task.plannedAt) ??
    '9999-12-31';
  return (
    leftDate.localeCompare(rightDate) ||
    right.task.updatedAt.localeCompare(left.task.updatedAt)
  );
}

function inRange(date: LocalDate, start: LocalDate, endExclusive: LocalDate): boolean {
  return compareLocalDates(date, start) >= 0 && compareLocalDates(date, endExclusive) < 0;
}

function pointDateInRange(
  point: SchedulePoint,
  start: LocalDate,
  endExclusive: LocalDate,
): boolean {
  const date = schedulePointLocalDate(point);
  return date !== undefined && inRange(date, start, endExclusive);
}

function bucket(items: RecoveryTaskView[]): ReviewBucket {
  items.sort(viewSort);
  return { count: items.length, items };
}

export class RecoveryService {
  private readonly now: () => string;
  private readonly detectTimeZone: () => string;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly todos: TodoService,
    dependencies: RecoveryServiceDependencies = {},
    private readonly recurrence?: RecurrenceService,
  ) {
    this.now = dependencies.now ?? defaultNow;
    this.detectTimeZone = dependencies.detectTimeZone ?? defaultTimeZone;
  }

  async snapshot(): Promise<RecoverySnapshot> {
    const { now, timeZone, tasks } = await this.loadContext();
    const today = instantToLocalDate(now, timeZone);
    const views = tasks.map((task) => taskView(task, now, timeZone));

    return {
      timeZone,
      asOf: now,
      today,
      todayItems: views
        .filter(
          ({ task }) =>
            task.state === 'pending' &&
            (schedulePointLocalDate(task.plannedAt) === today ||
              schedulePointLocalDate(task.deadlineAt) === today),
        )
        .sort(viewSort),
      missedPlanItems: views
        .filter(({ status }) => status.recoveryGroup === 'missedPlan')
        .sort(viewSort),
      overdueItems: views
        .filter(({ status }) => status.recoveryGroup === 'overdue')
        .sort(viewSort),
    };
  }

  async review(query: ReviewQuery): Promise<ReviewSnapshot> {
    const { now, timeZone, tasks } = await this.loadContext();
    const anchor = query.anchorDate ?? instantToLocalDate(now, timeZone);
    const anchorDate = Temporal.PlainDate.from(anchor);
    const startPlain =
      query.period === 'day'
        ? anchorDate
        : anchorDate.subtract({ days: anchorDate.dayOfWeek - 1 });
    const endPlain = startPlain.add({ days: query.period === 'day' ? 1 : 7 });
    const startDate = localDateSchema.parse(startPlain.toString());
    const endDateExclusive = localDateSchema.parse(endPlain.toString());
    const views = tasks.map((task) => taskView(task, now, timeZone));

    const completed = views.filter(({ task }) => {
      return (
        task.state === 'completed' &&
        inRange(
          instantToLocalDate(task.completedAt, timeZone),
          startDate,
          endDateExclusive,
        )
      );
    });
    const skipped = views.filter(({ task }) => {
      return (
        task.state === 'skipped' &&
        inRange(instantToLocalDate(task.skippedAt, timeZone), startDate, endDateExclusive)
      );
    });
    const missedPlan = views.filter(({ task, status }) => {
      return (
        status.recoveryGroup === 'missedPlan' &&
        pointDateInRange(task.plannedAt, startDate, endDateExclusive)
      );
    });
    const overdue = views.filter(({ task, status }) => {
      return (
        status.recoveryGroup === 'overdue' &&
        pointDateInRange(task.deadlineAt, startDate, endDateExclusive)
      );
    });

    return {
      period: query.period,
      timeZone,
      asOf: now,
      startDate,
      endDateExclusive,
      completed: bucket(completed),
      skipped: bucket(skipped),
      missedPlan: bucket(missedPlan),
      overdue: bucket(overdue),
    };
  }

  completeTask(taskId: string): Promise<SingleTask> {
    if (tryParseOccurrenceKey(taskId) !== undefined && this.recurrence !== undefined) {
      return this.recurrence
        .completeOccurrence(occurrenceKeySchema.parse(taskId))
        .then(() => this.loadTaskView(taskId));
    }
    return this.todos.setTaskState(taskId, 'completed');
  }

  skipTask(taskId: string): Promise<SingleTask> {
    if (tryParseOccurrenceKey(taskId) !== undefined && this.recurrence !== undefined) {
      return this.recurrence
        .skipOccurrence(occurrenceKeySchema.parse(taskId))
        .then(() => this.loadTaskView(taskId));
    }
    return this.todos.setTaskState(taskId, 'skipped');
  }

  rescheduleTask(taskId: string, patch: RescheduleTaskPatch): Promise<SingleTask> {
    if (tryParseOccurrenceKey(taskId) !== undefined && this.recurrence !== undefined) {
      return this.recurrence
        .rescheduleOccurrence(occurrenceKeySchema.parse(taskId), patch)
        .then(() => this.loadTaskView(taskId));
    }
    return this.todos.rescheduleTask(taskId, patch);
  }

  private async loadContext(): Promise<{
    readonly now: Instant;
    readonly timeZone: TimeZoneId;
    readonly tasks: SingleTask[];
  }> {
    const [singleTasks, series, occurrences, storedTimeZone] = await Promise.all([
      this.unitOfWork.repositories.singleTasks.getAll(),
      this.unitOfWork.repositories.recurrenceSeries.getAll(),
      this.unitOfWork.repositories.occurrenceRecords.getAll(),
      this.unitOfWork.repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
    ]);
    const seriesById = new Map(series.map((item) => [item.id, item]));
    const occurrenceTasks = occurrences.flatMap((occurrence): SingleTask[] => {
      const owner = seriesById.get(occurrence.seriesId);
      if (owner === undefined) return [];
      if (
        occurrence.state === 'pending' &&
        (owner.status !== 'active' ||
          owner.activeOccurrenceKey !== occurrence.occurrenceKey)
      )
        return [];
      const schedule = projectOccurrenceRecordSchedule(owner, occurrence);
      const template = occurrence.templateSnapshot ?? owner.template;
      return [
        singleTaskSchema.parse({
          id: occurrence.occurrenceKey,
          ...template,
          ...schedule,
          state: occurrence.state,
          ...(occurrence.completedAt !== undefined
            ? { completedAt: occurrence.completedAt }
            : {}),
          ...(occurrence.skippedAt !== undefined
            ? { skippedAt: occurrence.skippedAt }
            : {}),
          createdAt: owner.createdAt,
          updatedAt: occurrence.templateSnapshot?.capturedAt ?? owner.updatedAt,
        }),
      ];
    });
    return {
      now: decodeInstant(this.now()),
      timeZone: decodeTimeZoneId(storedTimeZone ?? this.detectTimeZone()),
      tasks: [...singleTasks, ...occurrenceTasks],
    };
  }

  private async loadTaskView(taskId: string): Promise<SingleTask> {
    const context = await this.loadContext();
    const task = context.tasks.find((item) => item.id === taskId);
    if (task !== undefined) return task;
    // A handled occurrence remains available as history under the same stable key.
    const occurrence = await this.unitOfWork.repositories.occurrenceRecords.get(
      occurrenceKeySchema.parse(taskId),
    );
    if (occurrence === undefined) {
      throw new DomainError(DomainErrorCode.INVALID_OCCURRENCE, 'Occurrence not found.');
    }
    const refreshed = await this.loadContext();
    const historical = refreshed.tasks.find((item) => item.id === taskId);
    if (historical === undefined) {
      throw new DomainError(
        DomainErrorCode.INVALID_OCCURRENCE,
        'Occurrence history not found.',
      );
    }
    return historical;
  }
}
