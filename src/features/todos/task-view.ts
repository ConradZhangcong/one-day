import { Temporal } from 'temporal-polyfill';

import {
  decodeInstant,
  instantToLocalDate,
  localDateSchema,
  prioritySchema,
  schedulePointLocalDate,
  SYSTEM_INBOX_ID,
  type LocalDate,
  type Priority,
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

function taskDates(task: SingleTask): string[] {
  return [
    schedulePointLocalDate(task.plannedAt),
    schedulePointLocalDate(task.deadlineAt),
  ].filter((value): value is LocalDate => value !== undefined);
}

export function projectTasks(
  tasks: readonly SingleTask[],
  kind: TodoViewKind,
  today: LocalDate,
  filters: TaskFilters,
  routeListId?: string,
): SingleTask[] {
  return tasks
    .filter((task) => {
      const dates = taskDates(task);
      if (kind === 'completed') {
        if (task.state === 'pending') return false;
      } else if (filters.state === undefined && task.state !== 'pending') return false;
      if (kind === 'inbox' && task.listId !== SYSTEM_INBOX_ID) return false;
      if (kind === 'list' && task.listId !== routeListId) return false;
      if (kind === 'today' && !dates.includes(today)) return false;
      if (kind === 'upcoming' && !dates.some((date) => date > today)) return false;
      if (filters.text) {
        const haystack = `${task.title}\n${task.notes}`
          .normalize('NFKC')
          .toLocaleLowerCase('zh-CN');
        if (!haystack.includes(filters.text.normalize('NFKC').toLocaleLowerCase('zh-CN')))
          return false;
      }
      if (filters.date && !dates.includes(filters.date)) return false;
      if (filters.listId && task.listId !== filters.listId) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.state && task.state !== filters.state) return false;
      if (
        filters.tagIds.length > 0 &&
        !filters.tagIds.every((id) => task.tagIds.includes(id))
      )
        return false;
      return true;
    })
    .sort((left, right) => {
      const leftDate = taskDates(left)[0] ?? '9999-12-31';
      const rightDate = taskDates(right)[0] ?? '9999-12-31';
      return (
        leftDate.localeCompare(rightDate) || right.updatedAt.localeCompare(left.updatedAt)
      );
    });
}

export function formatSchedule(task: SingleTask): string {
  const parts: string[] = [];
  if (task.plannedAt.kind === 'allDay') parts.push(`计划 ${task.plannedAt.date}`);
  if (task.plannedAt.kind === 'timed')
    parts.push(`计划 ${task.plannedAt.localDateTime.replace('T', ' ')}`);
  if (task.deadlineAt.kind === 'allDay') parts.push(`截止 ${task.deadlineAt.date}`);
  if (task.deadlineAt.kind === 'timed')
    parts.push(`截止 ${task.deadlineAt.localDateTime.replace('T', ' ')}`);
  return parts.join(' · ') || '未安排日期';
}
