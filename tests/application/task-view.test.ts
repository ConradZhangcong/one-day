import { describe, expect, it } from 'vitest';

import type { TaskOccurrenceView } from '../../src/application';
import {
  decodeInstant,
  decodeLocalDate,
  decodeSchedulePoint,
  decodeTimeZoneId,
} from '../../src/domain';
import {
  formatCompletedAt,
  getTodoView,
  projectOccurrences,
  projectTasks,
  projectTodoRows,
  taskFiltersFromSearchParams,
} from '../../src/features/todos/task-view';
import { createSingleTask } from '../infrastructure/db/fixtures';

const today = decodeLocalDate('2026-08-13');
const noFilters = { text: '', tagIds: [] } as const;

function occurrence(
  key: string,
  seriesId: string,
  date: string,
  overrides: Partial<TaskOccurrenceView> = {},
): TaskOccurrenceView {
  return {
    key,
    ownerKind: 'occurrence',
    ownerId: key,
    seriesId,
    title: `重复事项 ${seriesId}`,
    notes: '',
    plannedAt: { kind: 'allDay', date: decodeLocalDate(date) },
    deadlineAt: { kind: 'none' },
    state: 'pending',
    readonly: true,
    virtual: true,
    listId: 'system:inbox',
    tagIds: [],
    priority: 'none',
    ...overrides,
  };
}

describe('projectTasks', () => {
  it('classifies list routes consistently with or without a trailing slash', () => {
    expect(getTodoView('/today')).toBe('today');
    expect(getTodoView('/today/')).toBe('today');
    expect(getTodoView('/upcoming/')).toBe('upcoming');
    expect(getTodoView('/completed/')).toBe('completed');
    expect(getTodoView('/lists/list%3Awork/')).toBe('list');
  });

  it('keeps inbox, today, upcoming and completed meanings consistent', () => {
    const inbox = createSingleTask({
      id: 'inbox',
      plannedAt: { kind: 'none' },
      deadlineAt: { kind: 'none' },
    });
    const todayTask = createSingleTask({
      id: 'today',
      plannedAt: { kind: 'allDay', date: today },
      deadlineAt: { kind: 'none' },
    });
    const upcoming = createSingleTask({ id: 'upcoming' });
    const completed = createSingleTask({
      id: 'completed',
      state: 'completed',
      completedAt: decodeInstant('2026-08-13T02:00:00Z'),
    });
    const tasks = [inbox, todayTask, upcoming, completed];

    expect(projectTasks(tasks, 'inbox', today, noFilters).map((task) => task.id)).toEqual(
      ['today', 'upcoming', 'inbox'],
    );
    expect(projectTasks(tasks, 'today', today, noFilters).map((task) => task.id)).toEqual(
      ['today'],
    );
    expect(
      projectTasks(tasks, 'upcoming', today, noFilters).map((task) => task.id),
    ).toEqual(['upcoming']);
    expect(
      projectTasks(tasks, 'completed', today, noFilters).map((task) => task.id),
    ).toEqual(['completed']);
    expect(
      projectTasks(tasks, 'inbox', today, { ...noFilters, state: 'completed' }).map(
        (task) => task.id,
      ),
    ).toEqual(['completed']);
  });

  it('combines text, date, list, tag, priority and lifecycle filters', () => {
    const task = createSingleTask({
      title: '准备 周会',
      notes: '带上数据',
      tagIds: ['tag:meeting'],
      priority: 'high',
    });
    expect(
      projectTasks([task], 'inbox', today, {
        text: '数据',
        date: decodeLocalDate('2026-08-14'),
        listId: task.listId,
        tagIds: ['tag:meeting'],
        priority: 'high',
        state: 'pending',
      }),
    ).toEqual([task]);
    expect(
      projectTasks([task], 'inbox', today, { ...noFilters, text: '不存在' }),
    ).toEqual([]);
  });

  it('decodes URL filters and ignores malformed enum and date values', () => {
    const filters = taskFiltersFromSearchParams(
      new URLSearchParams(
        'q=%E5%91%A8%E4%BC%9A&date=2026-02-30&list=list%3Awork&tags=tag%3Aa%2Ctag%3Aa%2C%20&priority=urgent&state=deleted',
      ),
    );

    expect(filters).toEqual({
      text: '周会',
      date: undefined,
      listId: 'list:work',
      tagIds: ['tag:a'],
      priority: undefined,
      state: undefined,
    });
  });

  it('shows pending and completed work in today by default but requires an explicit skipped filter', () => {
    const pending = createSingleTask({
      id: 'task:pending',
      plannedAt: { kind: 'allDay', date: today },
      deadlineAt: { kind: 'none' },
    });
    const completed = createSingleTask({
      id: 'task:completed',
      plannedAt: { kind: 'allDay', date: today },
      deadlineAt: { kind: 'none' },
      state: 'completed',
      completedAt: decodeInstant('2026-08-13T02:00:00Z'),
    });
    const skipped = createSingleTask({
      id: 'task:skipped',
      plannedAt: { kind: 'allDay', date: today },
      deadlineAt: { kind: 'none' },
      state: 'skipped',
      skippedAt: decodeInstant('2026-08-13T03:00:00Z'),
    });

    expect(
      projectTasks([skipped, completed, pending], 'today', today, noFilters).map(
        (task) => task.id,
      ),
    ).toEqual(['task:completed', 'task:pending']);
    expect(
      projectTasks([skipped, completed, pending], 'today', today, {
        ...noFilters,
        state: 'completed',
      }).map((task) => task.id),
    ).toEqual(['task:completed']);
    expect(
      projectTasks([skipped, completed, pending], 'today', today, {
        ...noFilters,
        state: 'skipped',
      }).map((task) => task.id),
    ).toEqual(['task:skipped']);

    const completedOccurrence = occurrence(
      'series:completed:today',
      'series:completed',
      '2026-08-13',
      {
        state: 'completed',
        readonly: true,
        virtual: false,
        completedAt: decodeInstant('2026-08-13T04:00:00Z'),
      },
    );
    const skippedOccurrence = occurrence(
      'series:skipped:today',
      'series:skipped',
      '2026-08-13',
      { state: 'skipped', readonly: true, virtual: false },
    );
    expect(
      projectOccurrences(
        [skippedOccurrence, completedOccurrence],
        'today',
        today,
        noFilters,
      ).map((item) => item.key),
    ).toEqual(['series:completed:today']);
    expect(
      projectOccurrences([skippedOccurrence, completedOccurrence], 'today', today, {
        ...noFilters,
        state: 'skipped',
      }).map((item) => item.key),
    ).toEqual(['series:skipped:today']);
  });

  it('folds upcoming occurrences after filtering and leaves distinct series visible', () => {
    const first = occurrence('a:first', 'series:a', '2026-08-14');
    const second = occurrence('a:second', 'series:a', '2026-08-15');
    const other = occurrence('b:first', 'series:b', '2026-08-16');

    expect(
      projectOccurrences([second, other, first], 'upcoming', today, noFilters).map(
        (item) => item.key,
      ),
    ).toEqual(['a:first', 'b:first']);
    expect(
      projectOccurrences([first, second, other], 'upcoming', today, {
        ...noFilters,
        date: decodeLocalDate('2026-08-15'),
      }).map((item) => item.key),
    ).toEqual(['a:second']);
  });

  it('interleaves ordinary and recurring today rows by their primary schedule', () => {
    const laterTask = createSingleTask({
      id: 'task:later',
      plannedAt: decodeSchedulePoint({
        kind: 'timed',
        localDateTime: '2026-08-13T10:00',
      }),
      deadlineAt: { kind: 'none' },
    });
    const earlierTask = createSingleTask({
      id: 'task:earlier',
      plannedAt: decodeSchedulePoint({
        kind: 'timed',
        localDateTime: '2026-08-13T08:00',
      }),
      deadlineAt: { kind: 'none' },
    });
    const recurring = occurrence('series:a:today', 'series:a', '2026-08-13', {
      plannedAt: decodeSchedulePoint({
        kind: 'timed',
        localDateTime: '2026-08-13T09:00',
      }),
      readonly: false,
      virtual: false,
    });

    expect(
      projectTodoRows(
        [laterTask, earlierTask],
        [recurring],
        'today',
        today,
        noFilters,
      ).map((row) => row.key),
    ).toEqual(['task:earlier', 'series:a:today', 'task:later']);
  });

  it('formats a completed instant in the configured application time zone', () => {
    expect(
      formatCompletedAt(
        decodeInstant('2026-08-13T02:05:00Z'),
        decodeTimeZoneId('Asia/Shanghai'),
      ),
    ).toBe('完成于 10:05');
    expect(
      formatCompletedAt(undefined, decodeTimeZoneId('Asia/Shanghai')),
    ).toBeUndefined();
  });
});
