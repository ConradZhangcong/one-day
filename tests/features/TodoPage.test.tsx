import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskOccurrenceView, TodoSnapshot } from '../../src/application';
import {
  decodeInstant,
  decodeLocalDate,
  decodeTimeZoneId,
  taskListSchema,
} from '../../src/domain';
import { TodoPage } from '../../src/features/todos/TodoPage';
import { createSingleTask } from '../infrastructure/db/fixtures';

const hookMocks = vi.hoisted(() => ({
  useTodoSnapshot: vi.fn(),
  useCurrentLocalDate: vi.fn(),
}));

vi.mock('../../src/features/todos/useTodoSnapshot', () => ({
  useTodoSnapshot: hookMocks.useTodoSnapshot,
}));

vi.mock('../../src/features/todos/useCurrentLocalDate', () => ({
  useCurrentLocalDate: hookMocks.useCurrentLocalDate,
}));

vi.mock('@/app/application', () => ({
  getApplicationServices: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const today = decodeLocalDate('2026-08-13');

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

function snapshot(
  overrides: Partial<Pick<TodoSnapshot, 'tasks' | 'occurrences'>> = {},
): TodoSnapshot {
  return {
    tasks: [],
    lists: [
      taskListSchema.parse({
        id: 'system:inbox',
        name: '收件箱',
        order: 0,
        archived: false,
        isSystem: true,
      }),
    ],
    tags: [],
    timeZone: decodeTimeZoneId('Asia/Shanghai'),
    goals: [],
    occurrences: [],
    occurrenceWindowEnd: '2026-11-11',
    series: [],
    ...overrides,
  };
}

function renderPage(path: string, data: TodoSnapshot) {
  hookMocks.useTodoSnapshot.mockReturnValue(data);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TodoPage />
    </MemoryRouter>,
  );
}

describe('TodoPage rows', () => {
  beforeEach(() => {
    hookMocks.useTodoSnapshot.mockReset();
    hookMocks.useCurrentLocalDate.mockReset();
    hookMocks.useCurrentLocalDate.mockReturnValue(today);
  });

  it('renders completed ordinary and recurring rows with local completion details', async () => {
    const user = userEvent.setup();
    const task = createSingleTask({
      id: 'task:completed',
      title: '普通已完成',
      plannedAt: { kind: 'allDay', date: today },
      deadlineAt: { kind: 'none' },
      state: 'completed',
      completedAt: decodeInstant('2026-08-13T01:05:00Z'),
    });
    const completedOccurrence = occurrence(
      'series:daily:2026-08-13',
      'series:daily',
      '2026-08-13',
      {
        title: '重复已完成',
        state: 'completed',
        readonly: true,
        virtual: false,
        priority: 'high',
        completedAt: decodeInstant('2026-08-13T02:10:00Z'),
      },
    );

    renderPage('/today', snapshot({ tasks: [task], occurrences: [completedOccurrence] }));

    await user.click(screen.getByText('今天完成 · 2'));
    expect(screen.getAllByText('✓ 已完成')).toHaveLength(2);
    expect(screen.getByText('完成于 09:05')).toBeVisible();
    expect(screen.getByText('完成于 10:10')).toBeVisible();
    const occurrenceRow = screen.getByRole('button', {
      name: '查看重复事项重复已完成',
    });
    const recurringBadge = within(occurrenceRow).getByText('重复任务');
    expect(recurringBadge).toBeVisible();
    expect(recurringBadge.closest('span')?.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('高优先级')).toBeVisible();
    expect(screen.getByText('历史只读')).toBeVisible();

    await user.click(occurrenceRow);
    expect(screen.getByText(/历史只读：已处理的重复实例/)).toBeVisible();
    expect(screen.queryByRole('button', { name: '完成本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跳过本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '仅本次改期' })).not.toBeInTheDocument();
  });

  it('opens secondary task actions from the compact menu', async () => {
    const user = userEvent.setup();
    renderPage('/inbox', snapshot({ tasks: [createSingleTask({ title: '菜单任务' })] }));
    expect(screen.getByRole('button', { name: '完成菜单任务' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '删除菜单任务' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '更多操作：菜单任务' }));
    expect(screen.getByRole('button', { name: '删除菜单任务' })).toBeVisible();
  });

  it('opens a centered task composer without duplicating the quick input id', async () => {
    const user = userEvent.setup();
    renderPage('/today', snapshot());
    await user.click(screen.getByRole('button', { name: '添加任务' }));
    expect(screen.getByRole('dialog', { name: '添加任务' })).toBeVisible();
    expect(document.querySelectorAll('#quick-add-title')).toHaveLength(1);
    expect(
      within(screen.getByRole('dialog')).getByRole('textbox', { name: '任务标题' }),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows only the nearest filtered occurrence for each series in upcoming', () => {
    renderPage(
      '/upcoming',
      snapshot({
        occurrences: [
          occurrence('series:a:second', 'series:a', '2026-08-15'),
          occurrence('series:b:first', 'series:b', '2026-08-16'),
          occurrence('series:a:first', 'series:a', '2026-08-14'),
        ],
      }),
    );

    expect(
      screen.getByRole('button', { name: '查看重复事项重复事项 series:a' }),
    ).toHaveTextContent('2026-08-14');
    expect(
      screen.getByRole('button', { name: '查看重复事项重复事项 series:b' }),
    ).toHaveTextContent('2026-08-16');
    expect(screen.queryByText(/2026-08-15/)).not.toBeInTheDocument();
  });

  it('folds inbox series rows and keeps the visible recurring marker', () => {
    renderPage(
      '/inbox',
      snapshot({
        occurrences: [
          occurrence('series:a:second', 'series:a', '2026-08-15'),
          occurrence('series:a:first', 'series:a', '2026-08-14'),
        ],
      }),
    );

    const occurrenceRow = screen.getByRole('button', {
      name: '查看重复事项重复事项 series:a',
    });
    expect(occurrenceRow).toHaveTextContent('2026-08-14');
    expect(within(occurrenceRow).getByText('重复任务')).toBeVisible();
    expect(screen.queryByText(/2026-08-15/)).not.toBeInTheDocument();
  });
});
