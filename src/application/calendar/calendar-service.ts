import type {
  LocalDate,
  Priority,
  SchedulePoint,
  ScheduledPoint,
  TimeZoneId,
} from '../../domain';
import { OccurrenceQueryService, type TaskOccurrenceView } from '../occurrences';
import type { UnitOfWork } from '../repositories';

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
  readonly seriesId?: string;
  readonly title: string;
  readonly kind: 'planned' | 'deadline';
  readonly schedule: ScheduledPoint;
  readonly deadlineAt?: SchedulePoint;
  readonly state: 'pending' | 'completed' | 'skipped';
  readonly readonly: boolean;
  readonly virtual: boolean;
  readonly listId: string;
  readonly priority: Priority;
}

export interface CalendarSnapshot {
  readonly items: CalendarItemView[];
  readonly timeZone: TimeZoneId;
}

function matches(item: TaskOccurrenceView, query: CalendarQuery): boolean {
  return (
    (query.listId === undefined || item.listId === query.listId) &&
    (query.priority === undefined || item.priority === query.priority) &&
    item.state === (query.state ?? 'pending')
  );
}

export class CalendarService {
  private readonly occurrences: OccurrenceQueryService;

  constructor(unitOfWork: UnitOfWork, detectTimeZone?: () => string) {
    this.occurrences = new OccurrenceQueryService(unitOfWork, detectTimeZone);
  }

  async query(query: CalendarQuery): Promise<CalendarSnapshot> {
    const snapshot = await this.occurrences.query({
      rangeStart: query.rangeStart,
      rangeEnd: query.rangeEnd,
      includeHistory: query.state !== undefined && query.state !== 'pending',
    });
    const items = snapshot.items.flatMap((item): CalendarItemView[] => {
      if (!matches(item, query)) return [];
      const schedule = item.plannedAt.kind !== 'none' ? item.plannedAt : item.deadlineAt;
      if (schedule.kind === 'none') return [];
      return [
        {
          key: item.key,
          ownerKind: item.ownerKind,
          ownerId: item.ownerId,
          ...(item.seriesId !== undefined ? { seriesId: item.seriesId } : {}),
          title: item.title,
          kind: item.plannedAt.kind !== 'none' ? 'planned' : 'deadline',
          schedule,
          ...(item.deadlineAt.kind !== 'none' ? { deadlineAt: item.deadlineAt } : {}),
          state: item.state,
          readonly: item.readonly,
          virtual: item.virtual,
          listId: item.listId,
          priority: item.priority,
        },
      ];
    });
    return { items, timeZone: snapshot.timeZone };
  }
}
