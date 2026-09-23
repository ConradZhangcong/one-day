import { MemoryRouter } from 'react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarItemView, TodoSnapshot } from '../../src/application';
import {
  decodeLocalDate,
  decodeSchedulePoint,
  decodeTimeZoneId,
  recurrenceSeriesSchema,
  taskListSchema,
} from '../../src/domain';
import { OccurrenceDetailsDrawer } from '../../src/features/todos/OccurrenceDetailsDrawer';
import { QuickAdd } from '../../src/features/todos/TodoPage';
import { SeriesManager } from '../../src/features/todos/SeriesManager';
import { createSeries } from '../infrastructure/db/fixtures';

const serviceMocks = vi.hoisted(() => ({
  createSeries: vi.fn(),
  createTask: vi.fn(),
  updateSeries: vi.fn(),
  completeOccurrence: vi.fn(),
  skipOccurrence: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  updateOccurrenceSubtasks: vi.fn(),
  pauseSeries: vi.fn(),
  resumeSeries: vi.fn(),
  stopSeries: vi.fn(),
}));

vi.mock('@/app/application', () => ({
  getApplicationServices: () =>
    Promise.resolve({
      todos: { createTask: serviceMocks.createTask },
      recurrence: {
        createSeries: serviceMocks.createSeries,
        updateSeries: serviceMocks.updateSeries,
        completeOccurrence: serviceMocks.completeOccurrence,
        skipOccurrence: serviceMocks.skipOccurrence,
        rescheduleOccurrence: serviceMocks.rescheduleOccurrence,
        updateOccurrenceSubtasks: serviceMocks.updateOccurrenceSubtasks,
        pauseSeries: serviceMocks.pauseSeries,
        resumeSeries: serviceMocks.resumeSeries,
        stopSeries: serviceMocks.stopSeries,
      },
    }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function snapshot(): TodoSnapshot {
  const { series } = createSeries();
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
    occurrenceWindowEnd: '2026-12-01',
    series: [series],
  };
}

function occurrenceItem(virtual: boolean): CalendarItemView {
  const { series, occurrence } = createSeries();
  const schedule = virtual
    ? { kind: 'allDay' as const, date: decodeLocalDate('2026-08-21') }
    : occurrence.originalAnchor;
  return {
    key: virtual ? `${occurrence.occurrenceKey}:future` : occurrence.occurrenceKey,
    ownerKind: 'occurrence',
    ownerId: virtual ? `${occurrence.occurrenceKey}:future` : occurrence.occurrenceKey,
    seriesId: series.id,
    title: series.template.title,
    kind: 'planned',
    schedule,
    state: 'pending',
    readonly: virtual,
    virtual,
    listId: series.template.listId,
    priority: series.template.priority,
  };
}

describe('recurrence UI scope', () => {
  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) mock.mockReset();
    serviceMocks.createSeries.mockResolvedValue(undefined);
    serviceMocks.updateSeries.mockResolvedValue(undefined);
    serviceMocks.resumeSeries.mockResolvedValue(undefined);
  });

  it('keeps quick add ordinary by default and routes expanded recurrence directly to createSeries', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuickAdd defaultListId="system:inbox" today="2026-09-02" goals={[]} />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole('textbox', { name: '任务标题' }), '晨间复盘');
    expect(screen.queryByText('未来预览')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '日期与更多' }));
    await user.click(screen.getByRole('button', { name: '添加子项' }));
    await user.type(screen.getByRole('textbox', { name: '子项名称 1' }), '检查材料');
    await user.click(screen.getByRole('button', { name: '重复' }));
    await user.selectOptions(screen.getByLabelText('快速计划类型'), 'allDay');
    fireEvent.change(screen.getByLabelText('快速计划日期'), {
      target: { value: '2026-09-02' },
    });
    expect(screen.getByText('未来预览')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '创建重复事项' }));

    await waitFor(() => expect(serviceMocks.createSeries).toHaveBeenCalledOnce());
    expect(serviceMocks.createTask).not.toHaveBeenCalled();
    expect(serviceMocks.createSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '晨间复盘',
        subtasks: [
          { id: expect.any(String) as string, title: '检查材料', completed: false },
        ],
        plannedAt: { kind: 'allDay', date: '2026-09-02' },
        rule: {
          frequency: 'daily',
          interval: 1,
          end: { kind: 'never' },
        },
      }),
    );
  });

  it('saves subitem checks immediately without closing and shows future items read-only', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const item = {
      ...occurrenceItem(false),
      subtasks: [{ id: 's1', title: '检查材料', completed: false }],
    };
    const view = render(<OccurrenceDetailsDrawer item={item} onClose={onClose} />);
    await user.click(screen.getByRole('checkbox', { name: '完成子项：检查材料' }));
    expect(
      screen.queryByRole('button', { name: '保存本次子任务' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(serviceMocks.updateOccurrenceSubtasks).toHaveBeenCalledWith(item.ownerId, [
        { id: 's1', title: '检查材料', completed: true },
      ]),
    );
    expect(onClose).not.toHaveBeenCalled();
    view.unmount();
    render(
      <OccurrenceDetailsDrawer
        item={{ ...occurrenceItem(true), subtasks: item.subtasks }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('checkbox', { name: '完成子项：检查材料' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '保存本次子任务' }),
    ).not.toBeInTheDocument();
  });

  it('automatically saves subitem names on blur and deletions', async () => {
    const user = userEvent.setup();
    const item = {
      ...occurrenceItem(false),
      subtasks: [{ id: 's1', title: '检查材料', completed: false }],
    };
    render(<OccurrenceDetailsDrawer item={item} onClose={vi.fn()} />);
    const name = screen.getByRole('textbox', { name: '子项名称 1' });
    await user.click(name);
    await user.clear(name);
    await user.type(name, '准备材料');
    expect(serviceMocks.updateOccurrenceSubtasks).not.toHaveBeenCalled();
    await user.tab();
    await waitFor(() =>
      expect(serviceMocks.updateOccurrenceSubtasks).toHaveBeenCalledWith(item.ownerId, [
        { id: 's1', title: '准备材料', completed: false },
      ]),
    );
    const remove = screen.getByRole('button', { name: '删除子项 1' });
    await waitFor(() => expect(remove).toBeEnabled());
    await user.click(remove);
    await waitFor(() =>
      expect(serviceMocks.updateOccurrenceSubtasks).toHaveBeenLastCalledWith(
        item.ownerId,
        [],
      ),
    );
  });

  it('restores the last saved subitems after a failed automatic save and permits retry', async () => {
    const user = userEvent.setup();
    serviceMocks.updateOccurrenceSubtasks.mockRejectedValueOnce(new Error('offline'));
    render(
      <OccurrenceDetailsDrawer
        item={{
          ...occurrenceItem(false),
          subtasks: [{ id: 's1', title: '检查材料', completed: false }],
        }}
        onClose={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: '完成子项：检查材料' });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeChecked());
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);
    await waitFor(() =>
      expect(serviceMocks.updateOccurrenceSubtasks).toHaveBeenCalledTimes(2),
    );
    expect(checkbox).toBeChecked();
  });

  it('keeps the selected time when quick add moves the plan to tomorrow', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuickAdd defaultListId="system:inbox" today="2026-09-10" goals={[]} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: '日期与更多' }));
    await user.selectOptions(screen.getByLabelText('快速计划类型'), 'timed');
    fireEvent.change(screen.getByLabelText('快速计划时间'), {
      target: { value: '2026-09-10T18:30' },
    });
    await user.click(screen.getByRole('button', { name: '明天' }));
    expect(screen.getByLabelText('快速计划时间')).toHaveValue('2026-09-11T18:30');
  });

  it('preserves the precise plan and deadline when rescheduling one occurrence', async () => {
    const user = userEvent.setup();
    const item = {
      ...occurrenceItem(false),
      schedule: decodeSchedulePoint({ kind: 'timed', localDateTime: '2026-08-14T18:30' }),
      deadlineAt: decodeSchedulePoint({
        kind: 'timed',
        localDateTime: '2026-08-14T20:00',
      }),
    };
    if (item.schedule.kind === 'none') throw new Error('Expected schedule');
    render(
      <OccurrenceDetailsDrawer
        item={{ ...item, schedule: item.schedule }}
        snapshot={snapshot()}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: '仅本次改期' }));
    expect(screen.getByLabelText('仅本次计划时间')).toHaveValue('2026-08-14T18:30');
    fireEvent.change(screen.getByLabelText('仅本次计划时间'), {
      target: { value: '2026-08-14T19:00' },
    });
    await user.click(screen.getByRole('button', { name: '保存仅本次改期' }));
    await waitFor(() =>
      expect(serviceMocks.rescheduleOccurrence).toHaveBeenCalledWith(item.ownerId, {
        plannedAt: { kind: 'timed', localDateTime: '2026-08-14T19:00' },
        deadlineAt: { kind: 'timed', localDateTime: '2026-08-14T20:00' },
      }),
    );
  });

  it('never exposes current-instance commands for a virtual future item', () => {
    render(<OccurrenceDetailsDrawer item={occurrenceItem(true)} onClose={vi.fn()} />);
    expect(screen.getByText('未来只读')).toBeVisible();
    expect(screen.queryByRole('button', { name: '完成本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跳过本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '仅本次改期' })).not.toBeInTheDocument();
  });

  it('keeps a completed occurrence read-only', () => {
    const item = {
      ...occurrenceItem(false),
      state: 'completed' as const,
      readonly: true,
    };
    render(<OccurrenceDetailsDrawer item={item} onClose={vi.fn()} />);
    expect(screen.getByText(/历史只读：已处理的重复实例/)).toBeVisible();
    expect(screen.queryByRole('button', { name: '完成本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跳过本次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '仅本次改期' })).not.toBeInTheDocument();
  });

  it('requires explicit impact confirmation before updating the entire series', async () => {
    const user = userEvent.setup();
    const currentSnapshot = snapshot();
    const series = currentSnapshot.series[0];
    if (series === undefined) throw new TypeError('Expected a recurrence fixture.');
    render(
      <OccurrenceDetailsDrawer
        item={occurrenceItem(false)}
        series={series}
        snapshot={currentSnapshot}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '编辑整个系列' }));
    await user.clear(screen.getByRole('textbox', { name: '系列标题' }));
    await user.type(screen.getByRole('textbox', { name: '系列标题' }), '新版周回顾');
    await user.click(screen.getByRole('button', { name: '保存整个系列' }));
    expect(screen.getByText('确认编辑整个系列？')).toBeVisible();
    expect(screen.getByText(/当前待处理实例会被替换/)).toBeVisible();
    expect(serviceMocks.updateSeries).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认更新整个系列' }));

    await waitFor(() =>
      expect(serviceMocks.updateSeries).toHaveBeenCalledWith(
        series.id,
        expect.objectContaining({ title: '新版周回顾' }),
      ),
    );
  });

  it('keeps paused series discoverable and resumes the preserved current instance', async () => {
    const user = userEvent.setup();
    const currentSnapshot = snapshot();
    const active = currentSnapshot.series[0];
    if (active === undefined) throw new TypeError('Expected a recurrence fixture.');
    const paused = recurrenceSeriesSchema.parse({ ...active, status: 'paused' });
    render(
      <SeriesManager
        open
        snapshot={{ ...currentSnapshot, series: [paused] }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/可随时从这里恢复原当前实例/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '恢复整个系列' }));
    await waitFor(() =>
      expect(serviceMocks.resumeSeries).toHaveBeenCalledWith(paused.id),
    );
  });
});
