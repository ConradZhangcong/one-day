import { describe, expect, it } from 'vitest';

import { decodeInstant, decodeLocalDate } from '../../src/domain';
import {
  getTodoView,
  projectTasks,
  taskFiltersFromSearchParams,
} from '../../src/features/todos/task-view';
import { createSingleTask } from '../infrastructure/db/fixtures';

const today = decodeLocalDate('2026-08-13');
const noFilters = { text: '', tagIds: [] } as const;

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
});
