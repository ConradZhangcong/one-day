import {
  compareLocalDates,
  decodeTimeZoneId,
  projectActiveOccurrenceSchedule,
  schedulePointLocalDate,
  type LocalDate,
  type Priority,
  type SchedulePoint,
  type ScheduledPoint,
  type TimeZoneId,
} from '../../domain';
import type { UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';

export interface CalendarFilters {
  readonly listId?: string;
  readonly priority?: Priority;
  readonly state?: 'pending' | 'completed' | 'skipped';
}

export interface CalendarQuery extends CalendarFilters {
  readonly rangeStart: LocalDate;
  readonly rangeEnd: LocalDate;
}

export interface CalendarItemView {
  readonly key: string;
  readonly ownerKind: 'task' | 'occurrence';
  readonly ownerId: string;
  readonly title: string;
  readonly kind: 'planned' | 'deadline';
  readonly schedule: ScheduledPoint;
  readonly deadlineAt?: SchedulePoint;
  readonly state: 'pending' | 'completed' | 'skipped';
  readonly readonly: boolean;
  readonly listId: string;
  readonly priority: Priority;
}

export interface CalendarSnapshot {
  readonly items: CalendarItemView[];
  readonly timeZone: TimeZoneId;
}

function inRange(point: SchedulePoint, start: LocalDate, end: LocalDate): boolean {
  const date = schedulePointLocalDate(point);
  return (
    date !== undefined &&
    compareLocalDates(date, start) >= 0 &&
    compareLocalDates(date, end) < 0
  );
}

function matchesFilters(
  item: Pick<CalendarItemView, 'listId' | 'priority' | 'state'>,
  query: CalendarQuery,
): boolean {
  return (
    (query.listId === undefined || item.listId === query.listId) &&
    (query.priority === undefined || item.priority === query.priority) &&
    item.state === (query.state ?? 'pending')
  );
}

export class CalendarService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly detectTimeZone: () => string = () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {}

  async query(query: CalendarQuery): Promise<CalendarSnapshot> {
    const repositories = this.unitOfWork.repositories;
    const [tasks, series, occurrences, storedTimeZone] = await Promise.all([
      repositories.singleTasks.getAll(),
      repositories.recurrenceSeries.getAll(),
      repositories.occurrenceRecords.getAll(),
      repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
    ]);
    const items: CalendarItemView[] = [];

    for (const task of tasks) {
      const schedule = task.plannedAt.kind !== 'none' ? task.plannedAt : task.deadlineAt;
      if (
        schedule.kind === 'none' ||
        !inRange(schedule, query.rangeStart, query.rangeEnd)
      ) {
        continue;
      }
      const item: CalendarItemView = {
        key: task.id,
        ownerKind: 'task',
        ownerId: task.id,
        title: task.title,
        kind: task.plannedAt.kind !== 'none' ? 'planned' : 'deadline',
        schedule,
        ...(task.deadlineAt.kind !== 'none' ? { deadlineAt: task.deadlineAt } : {}),
        state: task.state,
        readonly: false,
        listId: task.listId,
        priority: task.priority,
      };
      if (matchesFilters(item, query)) items.push(item);
    }

    const seriesById = new Map(series.map((item) => [item.id, item]));
    for (const occurrence of occurrences) {
      const owner = seriesById.get(occurrence.seriesId);
      if (owner === undefined) continue;
      const projected = projectActiveOccurrenceSchedule(owner, occurrence);
      if (projected === undefined) continue;
      const schedule =
        projected.plannedAt.kind !== 'none' ? projected.plannedAt : projected.deadlineAt;
      if (
        schedule.kind === 'none' ||
        !inRange(schedule, query.rangeStart, query.rangeEnd)
      ) {
        continue;
      }
      const item: CalendarItemView = {
        key: occurrence.occurrenceKey,
        ownerKind: 'occurrence',
        ownerId: occurrence.occurrenceKey,
        title: occurrence.templateSnapshot?.title ?? owner.template.title,
        kind: projected.plannedAt.kind !== 'none' ? 'planned' : 'deadline',
        schedule,
        ...(projected.deadlineAt.kind !== 'none'
          ? { deadlineAt: projected.deadlineAt }
          : {}),
        state: occurrence.state,
        readonly: true,
        listId: owner.template.listId,
        priority: owner.template.priority,
      };
      if (matchesFilters(item, query)) items.push(item);
    }

    items.sort((left, right) => {
      const leftValue =
        left.schedule.kind === 'allDay'
          ? left.schedule.date
          : left.schedule.localDateTime;
      const rightValue =
        right.schedule.kind === 'allDay'
          ? right.schedule.date
          : right.schedule.localDateTime;
      return leftValue.localeCompare(rightValue) || left.title.localeCompare(right.title);
    });

    return {
      items,
      timeZone: decodeTimeZoneId(storedTimeZone ?? this.detectTimeZone()),
    };
  }
}
