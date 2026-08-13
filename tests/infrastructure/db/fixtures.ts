import {
  createOccurrenceKey,
  instantSchema,
  localDateSchema,
  occurrenceRecordSchema,
  recurrenceSeriesSchema,
  singleTaskSchema,
  taskListSchema,
  type OccurrenceRecord,
  type RecurrenceSeries,
  type SingleTask,
  type TaskList,
} from '../../../src/domain';
import { INBOX_LIST_ID } from '../../../src/infrastructure/db';

export const FIXTURE_INSTANT = instantSchema.parse('2026-08-13T01:00:00Z');

export function createTaskList(overrides: Partial<TaskList> = {}): TaskList {
  return taskListSchema.parse({
    id: 'list:work',
    name: '工作',
    order: 1,
    archived: false,
    isSystem: false,
    ...overrides,
  });
}

export function createSingleTask(overrides: Partial<SingleTask> = {}): SingleTask {
  return singleTaskSchema.parse({
    id: 'task:one',
    title: '准备周会',
    notes: '',
    listId: INBOX_LIST_ID,
    tagIds: [],
    priority: 'medium',
    plannedAt: {
      kind: 'timed',
      localDateTime: '2026-08-14T09:30',
    },
    deadlineAt: {
      kind: 'allDay',
      date: '2026-08-14',
    },
    state: 'pending',
    createdAt: FIXTURE_INSTANT,
    updatedAt: FIXTURE_INSTANT,
    ...overrides,
  });
}

export function createSeries(options?: { id?: string; listId?: string }): {
  series: RecurrenceSeries;
  occurrence: OccurrenceRecord;
} {
  const id = options?.id ?? 'series:weekly-review';
  const originalAnchor = {
    kind: 'allDay' as const,
    date: localDateSchema.parse('2026-08-14'),
  };
  const occurrenceKey = createOccurrenceKey(id, 1, originalAnchor);
  const series = recurrenceSeriesSchema.parse({
    id,
    template: {
      title: '每周回顾',
      notes: '',
      listId: options?.listId ?? INBOX_LIST_ID,
      tagIds: [],
      priority: 'low',
      plannedAt: originalAnchor,
      deadlineAt: { kind: 'none' },
    },
    anchor: 'planned',
    rule: {
      frequency: 'weekly',
      interval: 1,
      weekdays: [5],
      end: { kind: 'never' },
    },
    status: 'active',
    activeOccurrenceKey: occurrenceKey,
    revision: 1,
    createdAt: FIXTURE_INSTANT,
    updatedAt: FIXTURE_INSTANT,
  });
  const occurrence = occurrenceRecordSchema.parse({
    occurrenceKey,
    seriesId: id,
    originalAnchor,
    state: 'pending',
  });

  return { series, occurrence };
}
