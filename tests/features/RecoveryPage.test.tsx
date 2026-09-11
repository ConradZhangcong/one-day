import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecoverySnapshot } from '../../src/application';
import {
  decodeInstant,
  decodeLocalDate,
  decodeTimeZoneId,
  deriveTaskStatus,
} from '../../src/domain';
import { RecoveryPage } from '../../src/features/recovery/RecoveryPage';
import { createSingleTask } from '../infrastructure/db/fixtures';

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn<() => RecoverySnapshot | undefined>(),
  completeTask: vi.fn(),
  skipTask: vi.fn(),
  rescheduleTask: vi.fn(),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => mocks.snapshot() }));
vi.mock('@/app/application', () => ({
  getApplicationServices: () => Promise.resolve({ recovery: mocks }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function snapshot(): RecoverySnapshot {
  const asOf = decodeInstant('2026-09-09T04:00:00Z');
  const timeZone = decodeTimeZoneId('Asia/Shanghai');
  const missed = createSingleTask({
    id: 'task:missed',
    title: '整理资料',
    plannedAt: { kind: 'allDay', date: decodeLocalDate('2026-09-08') },
    deadlineAt: { kind: 'none' },
  });
  const overdue = createSingleTask({
    id: 'task:overdue',
    title: '提交报告',
    plannedAt: { kind: 'allDay', date: decodeLocalDate('2026-09-07') },
    deadlineAt: { kind: 'allDay', date: decodeLocalDate('2026-09-08') },
  });
  return {
    asOf,
    timeZone,
    today: decodeLocalDate('2026-09-09'),
    todayItems: [],
    missedPlanItems: [{ task: missed, status: deriveTaskStatus(missed, asOf, timeZone) }],
    overdueItems: [{ task: overdue, status: deriveTaskStatus(overdue, asOf, timeZone) }],
  };
}

function page(path = '/recovery') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RecoveryPage />
    </MemoryRouter>,
  );
}

describe('combined recovery list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.snapshot.mockReturnValue(snapshot());
  });

  it.each(['/recovery', '/recovery?kind=missed', '/recovery?kind=overdue'])(
    'shows both states once with overdue first at %s',
    (path) => {
      page(path);
      expect(screen.getByRole('heading', { name: '待恢复' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: '恢复分组' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('共 2 项待恢复');
      const cards = screen.getAllByRole('article');
      expect(cards).toHaveLength(2);
      expect(within(cards[0]!).getByRole('heading')).toHaveTextContent('提交报告');
      expect(within(cards[0]!).getByText('已逾期')).toBeInTheDocument();
      expect(within(cards[0]!).getByText('计划也已错过')).toBeInTheDocument();
      expect(within(cards[1]!).getByText('错过计划')).toBeInTheDocument();
    },
  );

  it('keeps complete, skip and reschedule actions attached to the correct task', async () => {
    const user = userEvent.setup();
    page();
    await user.click(screen.getByRole('button', { name: '完成提交报告' }));
    expect(mocks.completeTask).toHaveBeenCalledWith('task:overdue');
    await user.click(screen.getByRole('button', { name: '跳过整理资料' }));
    expect(mocks.skipTask).toHaveBeenCalledWith('task:missed');
    await user.click(screen.getByRole('button', { name: '重新安排整理资料' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('重新安排“整理资料”');
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(mocks.rescheduleTask).not.toHaveBeenCalled();
  });

  it('shows one empty state when both groups are empty', () => {
    mocks.snapshot.mockReturnValue({
      ...snapshot(),
      missedPlanItems: [],
      overdueItems: [],
    });
    page();
    expect(screen.getByText('没有需要恢复的任务')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('共 0 项待恢复');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
