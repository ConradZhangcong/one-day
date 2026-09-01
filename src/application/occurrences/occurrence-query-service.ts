import { Temporal } from 'temporal-polyfill';

import {
  compareLocalDates,
  decodeTimeZoneId,
  localDateSchema,
  localDateTimeSchema,
  projectOccurrenceRange,
  projectOccurrenceRecordSchedule,
  schedulePointLocalDate,
  type Instant,
  type LocalDate,
  type OccurrenceRecord,
  type Priority,
  type RecurrenceSeries,
  type SchedulePoint,
  type ScheduledPoint,
  type TimeZoneId,
} from '../../domain';
import type { UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';

export const MAX_OCCURRENCE_QUERY_DAYS = 366;
export const MAX_OCCURRENCE_QUERY_RESULTS = 1_000;

export interface TaskOccurrenceView {
  readonly key: string;
  readonly ownerKind: 'task' | 'occurrence';
  readonly ownerId: string;
  readonly seriesId?: string;
  readonly title: string;
  readonly notes: string;
  readonly plannedAt: SchedulePoint;
  readonly deadlineAt: SchedulePoint;
  readonly state: 'pending' | 'completed' | 'skipped';
  readonly readonly: boolean;
  readonly virtual: boolean;
  readonly listId: string;
  readonly tagIds: readonly string[];
  readonly goalId?: string;
  readonly priority: Priority;
  readonly updatedAt?: Instant;
}

export interface OccurrenceRangeQuery {
  readonly rangeStart: LocalDate;
  readonly rangeEnd: LocalDate;
  readonly includeHistory?: boolean;
  readonly limit?: number;
}

export interface OccurrenceQuerySnapshot {
  readonly items: TaskOccurrenceView[];
  readonly timeZone: TimeZoneId;
}

function primarySchedule(item: Pick<TaskOccurrenceView, 'plannedAt' | 'deadlineAt'>) {
  return item.plannedAt.kind !== 'none' ? item.plannedAt : item.deadlineAt;
}

function inRange(point: SchedulePoint, start: LocalDate, end: LocalDate): boolean {
  const date = schedulePointLocalDate(point);
  return (
    date !== undefined &&
    compareLocalDates(date, start) >= 0 &&
    compareLocalDates(date, end) < 0
  );
}

function rangePoint(date: LocalDate, anchor: ScheduledPoint): ScheduledPoint {
  if (anchor.kind === 'allDay') return { kind: 'allDay', date };
  return {
    kind: 'timed',
    localDateTime: localDateTimeSchema.parse(`${date}T${anchor.localDateTime.slice(11)}`),
  };
}

function occurrenceView(
  series: RecurrenceSeries,
  occurrence: OccurrenceRecord,
  virtual: boolean,
): TaskOccurrenceView {
  const schedule = projectOccurrenceRecordSchedule(series, occurrence);
  const template = occurrence.templateSnapshot ?? series.template;
  return {
    key: occurrence.occurrenceKey,
    ownerKind: 'occurrence',
    ownerId: occurrence.occurrenceKey,
    seriesId: series.id,
    title: template.title,
    notes: template.notes,
    plannedAt: schedule.plannedAt,
    deadlineAt: schedule.deadlineAt,
    state: occurrence.state,
    readonly: virtual || occurrence.state !== 'pending',
    virtual,
    listId: template.listId,
    tagIds: template.tagIds,
    ...(template.goalId === undefined ? {} : { goalId: template.goalId }),
    priority: template.priority,
    updatedAt: series.updatedAt,
  };
}

export class OccurrenceQueryService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly detectTimeZone: () => string = () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {}

  async query(query: OccurrenceRangeQuery): Promise<OccurrenceQuerySnapshot> {
    const start = localDateSchema.parse(query.rangeStart);
    const end = localDateSchema.parse(query.rangeEnd);
    const days = Temporal.PlainDate.from(start).until(end).days;
    const limit = query.limit ?? MAX_OCCURRENCE_QUERY_RESULTS;
    if (
      days < 0 ||
      days > MAX_OCCURRENCE_QUERY_DAYS ||
      limit < 1 ||
      limit > MAX_OCCURRENCE_QUERY_RESULTS
    ) {
      throw new RangeError('Occurrence query range or result limit is invalid.');
    }
    const repositories = this.unitOfWork.repositories;
    const [tasks, allSeries, records, storedZone] = await Promise.all([
      repositories.singleTasks.getAll(),
      repositories.recurrenceSeries.getAll(),
      repositories.occurrenceRecords.getAll(),
      repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
    ]);
    const items: TaskOccurrenceView[] = tasks
      .map((task): TaskOccurrenceView => ({
        key: task.id,
        ownerKind: 'task',
        ownerId: task.id,
        title: task.title,
        notes: task.notes,
        plannedAt: task.plannedAt,
        deadlineAt: task.deadlineAt,
        state: task.state,
        readonly: false,
        virtual: false,
        listId: task.listId,
        tagIds: task.tagIds,
        ...(task.goalId === undefined ? {} : { goalId: task.goalId }),
        priority: task.priority,
        updatedAt: task.updatedAt,
      }))
      .filter((item) => inRange(primarySchedule(item), start, end));
    const recordsBySeries = new Map<string, OccurrenceRecord[]>();
    for (const record of records) {
      const current = recordsBySeries.get(record.seriesId) ?? [];
      current.push(record);
      recordsBySeries.set(record.seriesId, current);
    }
    for (const series of allSeries) {
      const seriesRecords = recordsBySeries.get(series.id) ?? [];
      if (query.includeHistory) {
        for (const record of seriesRecords.filter((item) => item.state !== 'pending')) {
          const view = occurrenceView(series, record, false);
          if (inRange(primarySchedule(view), start, end)) items.push(view);
        }
      }
      if (series.status !== 'active' || series.activeOccurrenceKey === undefined)
        continue;
      const active = seriesRecords.find(
        (item) => item.occurrenceKey === series.activeOccurrenceKey,
      );
      if (active?.state !== 'pending') continue;
      const activeView = occurrenceView(series, active, false);
      if (inRange(primarySchedule(activeView), start, end)) items.push(activeView);
      const templateAnchor =
        series.anchor === 'planned'
          ? series.template.plannedAt
          : series.template.deadlineAt;
      if (templateAnchor.kind === 'none') continue;
      const projected = projectOccurrenceRange({
        seriesId: series.id,
        revision: series.revision,
        anchor: templateAnchor,
        rule: series.rule,
        rangeStart: rangePoint(start, templateAnchor),
        rangeEnd: rangePoint(end, templateAnchor),
        limit: Math.min(limit, MAX_OCCURRENCE_QUERY_RESULTS),
      });
      for (const identity of projected) {
        if (identity.occurrenceKey === series.activeOccurrenceKey) continue;
        const virtualRecord: OccurrenceRecord = {
          occurrenceKey: identity.occurrenceKey,
          seriesId: series.id,
          originalAnchor: identity.originalAnchor,
          state: 'pending',
        };
        const view = occurrenceView(series, virtualRecord, true);
        if (inRange(primarySchedule(view), start, end)) items.push(view);
      }
    }
    items.sort((left, right) => {
      const leftPoint = primarySchedule(left);
      const rightPoint = primarySchedule(right);
      const leftValue =
        leftPoint.kind === 'allDay'
          ? leftPoint.date
          : leftPoint.kind === 'timed'
            ? leftPoint.localDateTime
            : '';
      const rightValue =
        rightPoint.kind === 'allDay'
          ? rightPoint.date
          : rightPoint.kind === 'timed'
            ? rightPoint.localDateTime
            : '';
      return (
        leftValue.localeCompare(rightValue) ||
        left.title.localeCompare(right.title) ||
        left.key.localeCompare(right.key)
      );
    });
    return {
      items: items.slice(0, limit),
      timeZone: decodeTimeZoneId(storedZone ?? this.detectTimeZone()),
    };
  }
}
