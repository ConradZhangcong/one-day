import { Temporal } from 'temporal-polyfill';

import type { TaskOccurrenceView } from '@/application';
import {
  decodeInstant,
  instantToLocalDate,
  localDateSchema,
  prioritySchema,
  schedulePointLocalDate,
  SYSTEM_INBOX_ID,
  type Instant,
  type LocalDate,
  type Priority,
  type SchedulePoint,
  type SingleTask,
  type TimeZoneId,
} from '@/domain';

export type TodoViewKind = 'inbox' | 'today' | 'upcoming' | 'completed' | 'list';

export function getTodoView(pathname: string): TodoViewKind {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/today') return 'today';
  if (normalized === '/upcoming') return 'upcoming';
  if (normalized === '/completed') return 'completed';
  if (normalized.startsWith('/lists/')) return 'list';
  return 'inbox';
}

export interface TaskFilters {
  readonly text: string;
  readonly date?: LocalDate | undefined;
  readonly listId?: string | undefined;
  readonly tagIds: readonly string[];
  readonly priority?: Priority | undefined;
  readonly state?: SingleTask['state'] | undefined;
}

interface TodoRowBase {
  readonly key: string;
  readonly title: string;
  readonly notes: string;
  readonly plannedAt: SchedulePoint;
  readonly deadlineAt: SchedulePoint;
  readonly state: SingleTask['state'];
  readonly listId: string;
  readonly tagIds: readonly string[];
  readonly priority: Priority;
  readonly completedAt?: Instant;
  readonly readonly: boolean;
  readonly virtual: boolean;
}

export type TodoTaskRow = TodoRowBase & {
  readonly kind: 'task';
  readonly task: SingleTask;
};

export type TodoOccurrenceRow = TodoRowBase & {
  readonly kind: 'occurrence';
  readonly occurrence: TaskOccurrenceView;
};

export type TodoRow = TodoTaskRow | TodoOccurrenceRow;

function isTaskState(value: string | null): value is SingleTask['state'] {
  return value === 'pending' || value === 'completed' || value === 'skipped';
}

/** URL query values are external input; invalid values are ignored, not cast into filters. */
export function taskFiltersFromSearchParams(searchParams: URLSearchParams): TaskFilters {
  const parsedDate = localDateSchema.safeParse(searchParams.get('date'));
  const parsedPriority = prioritySchema.safeParse(searchParams.get('priority'));
  const stateValue = searchParams.get('state');
  const listValue = searchParams.get('list')?.trim();
  const tagIds = [
    ...new Set(
      (searchParams.get('tags') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  return {
    text: searchParams.get('q') ?? '',
    date: parsedDate.success ? parsedDate.data : undefined,
    listId: listValue === '' ? undefined : listValue,
    tagIds,
    priority: parsedPriority.success ? parsedPriority.data : undefined,
    state: isTaskState(stateValue) ? stateValue : undefined,
  };
}

export function todayInTimeZone(timeZone: TimeZoneId): LocalDate {
  return instantToLocalDate(decodeInstant(Temporal.Now.instant().toString()), timeZone);
}

type FilterableItem = Pick<
  TodoRowBase,
  | 'title'
  | 'notes'
  | 'plannedAt'
  | 'deadlineAt'
  | 'state'
  | 'listId'
  | 'tagIds'
  | 'priority'
>;

function itemDates(item: Pick<FilterableItem, 'plannedAt' | 'deadlineAt'>): LocalDate[] {
  return [
    schedulePointLocalDate(item.plannedAt),
    schedulePointLocalDate(item.deadlineAt),
  ].filter((value): value is LocalDate => value !== undefined);
}

function matchesDefaultState(
  state: SingleTask['state'],
  kind: TodoViewKind,
  selectedState: SingleTask['state'] | undefined,
): boolean {
  if (kind === 'completed' && state === 'pending') return false;
  if (selectedState !== undefined) return state === selectedState;
  if (kind === 'today') return state === 'pending' || state === 'completed';
  if (kind === 'completed') return true;
  return state === 'pending';
}

function matchesItem(
  item: FilterableItem,
  kind: TodoViewKind,
  today: LocalDate,
  filters: TaskFilters,
  routeListId?: string,
): boolean {
  const dates = itemDates(item);
  if (!matchesDefaultState(item.state, kind, filters.state)) return false;
  if (kind === 'inbox' && item.listId !== SYSTEM_INBOX_ID) return false;
  if (kind === 'list' && item.listId !== routeListId) return false;
  if (kind === 'today' && !dates.includes(today)) return false;
  if (kind === 'upcoming' && !dates.some((date) => date > today)) return false;
  if (filters.text) {
    const haystack = `${item.title}\n${item.notes}`
      .normalize('NFKC')
      .toLocaleLowerCase('zh-CN');
    if (!haystack.includes(filters.text.normalize('NFKC').toLocaleLowerCase('zh-CN')))
      return false;
  }
  if (filters.date && !dates.includes(filters.date)) return false;
  if (filters.listId && item.listId !== filters.listId) return false;
  if (filters.priority && item.priority !== filters.priority) return false;
  if (
    filters.tagIds.length > 0 &&
    !filters.tagIds.every((id) => item.tagIds.includes(id))
  )
    return false;
  return true;
}

function primaryScheduleValue(
  item: Pick<FilterableItem, 'plannedAt' | 'deadlineAt'>,
): string {
  const schedule = item.plannedAt.kind !== 'none' ? item.plannedAt : item.deadlineAt;
  if (schedule.kind === 'allDay') return `${schedule.date}T00:00`;
  if (schedule.kind === 'timed') return schedule.localDateTime;
  return '9999-12-31T23:59';
}

function compareRows(left: TodoRow, right: TodoRow): number {
  return (
    primaryScheduleValue(left).localeCompare(primaryScheduleValue(right)) ||
    left.title.localeCompare(right.title, 'zh-CN') ||
    left.key.localeCompare(right.key)
  );
}

export function projectTasks(
  tasks: readonly SingleTask[],
  kind: TodoViewKind,
  today: LocalDate,
  filters: TaskFilters,
  routeListId?: string,
): SingleTask[] {
  return tasks
    .filter((task) => matchesItem(task, kind, today, filters, routeListId))
    .sort((left, right) => {
      const scheduleOrder = primaryScheduleValue(left).localeCompare(
        primaryScheduleValue(right),
      );
      return (
        scheduleOrder ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id)
      );
    });
}

function toTaskRow(task: SingleTask): TodoTaskRow {
  return {
    kind: 'task',
    key: task.id,
    title: task.title,
    notes: task.notes,
    plannedAt: task.plannedAt,
    deadlineAt: task.deadlineAt,
    state: task.state,
    listId: task.listId,
    tagIds: task.tagIds,
    priority: task.priority,
    ...(task.state === 'completed' ? { completedAt: task.completedAt } : {}),
    readonly: false,
    virtual: false,
    task,
  };
}

function toOccurrenceRow(occurrence: TaskOccurrenceView): TodoOccurrenceRow {
  return {
    kind: 'occurrence',
    key: occurrence.key,
    title: occurrence.title,
    notes: occurrence.notes,
    plannedAt: occurrence.plannedAt,
    deadlineAt: occurrence.deadlineAt,
    state: occurrence.state,
    listId: occurrence.listId,
    tagIds: occurrence.tagIds,
    priority: occurrence.priority,
    ...(occurrence.completedAt === undefined
      ? {}
      : { completedAt: occurrence.completedAt }),
    readonly: occurrence.readonly,
    virtual: occurrence.virtual,
    occurrence,
  };
}

export function projectOccurrences(
  occurrences: readonly TaskOccurrenceView[],
  kind: TodoViewKind,
  today: LocalDate,
  filters: TaskFilters,
  routeListId?: string,
): TaskOccurrenceView[] {
  // The completed route has never been an occurrence-history view. The Todo snapshot
  // deliberately loads only today's history, so showing it there would be incomplete.
  if (kind === 'completed') return [];
  const filtered = occurrences
    .filter((item) => matchesItem(item, kind, today, filters, routeListId))
    .sort((left, right) => compareRows(toOccurrenceRow(left), toOccurrenceRow(right)));
  if (kind !== 'upcoming') return filtered;

  const nearestBySeries = new Map<string, TaskOccurrenceView>();
  for (const item of filtered) {
    const groupKey = item.seriesId ?? item.key;
    if (!nearestBySeries.has(groupKey)) nearestBySeries.set(groupKey, item);
  }
  return [...nearestBySeries.values()];
}

export function projectTodoRows(
  tasks: readonly SingleTask[],
  occurrences: readonly TaskOccurrenceView[],
  kind: TodoViewKind,
  today: LocalDate,
  filters: TaskFilters,
  routeListId?: string,
): TodoRow[] {
  return [
    ...projectTasks(tasks, kind, today, filters, routeListId).map(toTaskRow),
    ...projectOccurrences(occurrences, kind, today, filters, routeListId).map(
      toOccurrenceRow,
    ),
  ].sort(compareRows);
}

export function formatSchedule(
  task: Pick<FilterableItem, 'plannedAt' | 'deadlineAt'>,
): string {
  const parts: string[] = [];
  if (task.plannedAt.kind === 'allDay') parts.push(`计划 ${task.plannedAt.date}`);
  if (task.plannedAt.kind === 'timed')
    parts.push(`计划 ${task.plannedAt.localDateTime.replace('T', ' ')}`);
  if (task.deadlineAt.kind === 'allDay') parts.push(`截止 ${task.deadlineAt.date}`);
  if (task.deadlineAt.kind === 'timed')
    parts.push(`截止 ${task.deadlineAt.localDateTime.replace('T', ' ')}`);
  return parts.join(' · ') || '未安排日期';
}

export function formatCompletedAt(
  completedAt: Instant | undefined,
  timeZone: TimeZoneId,
): string | undefined {
  if (completedAt === undefined) return undefined;
  const local = Temporal.Instant.from(completedAt).toZonedDateTimeISO(timeZone);
  return `完成于 ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}
