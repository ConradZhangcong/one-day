import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackupInspection } from '../../src/application';
import { DomainError, DomainErrorCode } from '../../src/domain';
import { BackupRestoreCard } from '../../src/features/settings/BackupRestoreCard';
import { createMinimalBackup } from '../backup-fixtures';

const serviceMocks = vi.hoisted(() => ({
  createExport: vi.fn(),
  inspect: vi.fn(),
  restore: vi.fn(),
  clearLocalData: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/app/application', () => ({
  getApplicationServices: () =>
    Promise.resolve({
      backup: serviceMocks,
    }),
}));

vi.mock('sonner', () => ({ toast: toastMocks }));

function inspection(): BackupInspection {
  const backup = createMinimalBackup();
  return {
    backup,
    summary: {
      exportedAt: backup.exportedAt,
      timeZone: backup.timeZone,
      counts: {
        singleTasks: 0,
        recurrenceSeries: 0,
        occurrenceRecords: 0,
        lists: 1,
        tags: 0,
        reminders: 0,
        longTermGoals: 0,
      },
    },
  };
}

function backupFile(contents = JSON.stringify(createMinimalBackup())): File {
  const file = new File([contents], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: () => Promise.resolve(contents),
  });
  return file;
}

describe('BackupRestoreCard', () => {
  const createObjectURL = vi.fn(() => 'blob:backup');
  const revokeObjectURL = vi.fn();
  const click = vi.fn();

  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) mock.mockReset();
    for (const mock of Object.values(toastMocks)) mock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    click.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: click,
    });
    serviceMocks.createExport.mockResolvedValue(createMinimalBackup());
    serviceMocks.inspect.mockReturnValue(inspection());
    serviceMocks.restore.mockResolvedValue(inspection().summary);
    serviceMocks.clearLocalData.mockResolvedValue(undefined);
  });

  it('downloads a versioned JSON file and releases the object URL', async () => {
    const user = userEvent.setup();
    render(<BackupRestoreCard />);

    await user.click(screen.getByRole('button', { name: '导出备份' }));

    await waitFor(() => expect(serviceMocks.createExport).toHaveBeenCalledOnce());
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
    expect(toastMocks.success).toHaveBeenCalledWith('备份文件已生成，请妥善保存。');
  });

  it('inspects a file and cancellation performs no restore', async () => {
    const user = userEvent.setup();
    render(<BackupRestoreCard />);

    await user.upload(screen.getByLabelText('选择 One Day JSON 备份'), backupFile());
    expect(await screen.findByText('备份摘要')).toBeVisible();
    expect(screen.getByText('Asia/Shanghai')).toBeVisible();
    expect(serviceMocks.inspect).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText('备份摘要')).not.toBeInTheDocument();
    expect(serviceMocks.restore).not.toHaveBeenCalled();
  });

  it('requires destructive confirmation before restoring', async () => {
    const user = userEvent.setup();
    render(<BackupRestoreCard />);
    await user.upload(screen.getByLabelText('选择 One Day JSON 备份'), backupFile());
    await screen.findByText('备份摘要');

    await user.click(screen.getByRole('button', { name: '恢复此备份' }));
    expect(screen.getByText('替换当前设备上的全部数据？')).toBeVisible();
    expect(serviceMocks.restore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认替换并恢复' }));

    await waitFor(() => expect(serviceMocks.restore).toHaveBeenCalledOnce());
    expect(toastMocks.success).toHaveBeenCalledWith(
      '备份已恢复，页面数据和提醒已重新加载。',
    );
  });

  it('maps invalid backup errors without exposing file contents', async () => {
    const user = userEvent.setup();
    serviceMocks.inspect.mockImplementation(() => {
      throw new DomainError(
        DomainErrorCode.BACKUP_INVALID_DATA,
        'sensitive raw contents',
      );
    });
    render(<BackupRestoreCard />);

    await user.upload(
      screen.getByLabelText('选择 One Day JSON 备份'),
      backupFile('private task content'),
    );

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        '备份内容损坏或引用不完整，未修改当前数据。',
      ),
    );
    expect(screen.queryByText('private task content')).not.toBeInTheDocument();
  });

  it('shows the permanent deletion scope and cancellation performs no clear', async () => {
    const user = userEvent.setup();
    render(<BackupRestoreCard />);

    expect(screen.getByText('危险操作')).toBeVisible();
    expect(screen.getByText(/建议先导出完整备份/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '清空本地数据' }));

    expect(screen.getByText('确认清空此设备上的全部数据？')).toBeVisible();
    expect(serviceMocks.clearLocalData).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消，保留数据' }));
    expect(serviceMocks.clearLocalData).not.toHaveBeenCalled();
  });

  it('confirms a clear only once and discards a pending restore inspection', async () => {
    let resolveClear: (() => void) | undefined;
    serviceMocks.clearLocalData.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveClear = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<BackupRestoreCard />);
    await user.upload(screen.getByLabelText('选择 One Day JSON 备份'), backupFile());
    await screen.findByText('备份摘要');
    await user.click(screen.getByRole('button', { name: '清空本地数据' }));
    const confirm = screen.getByRole('button', { name: '确认清空全部数据' });
    await user.dblClick(confirm);

    expect(serviceMocks.clearLocalData).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '正在清空…' })).toBeDisabled();
    resolveClear?.();
    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith(
        '本地数据已清空，One Day 已恢复为全新状态。',
      ),
    );
    expect(screen.queryByText('备份摘要')).not.toBeInTheDocument();
  });

  it('reports clear failure without claiming data was deleted', async () => {
    serviceMocks.clearLocalData.mockRejectedValue(new Error('storage failed'));
    const user = userEvent.setup();
    render(<BackupRestoreCard />);
    await user.click(screen.getByRole('button', { name: '清空本地数据' }));
    await user.click(screen.getByRole('button', { name: '确认清空全部数据' }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith('清空失败，原数据保持不变。'),
    );
    expect(toastMocks.success).not.toHaveBeenCalledWith(
      '本地数据已清空，One Day 已恢复为全新状态。',
    );
  });
});
