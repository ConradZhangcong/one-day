import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyApplicationChanged } from '../../src/app/application-change';
import { SettingsPage } from '../../src/features/settings/SettingsPage';

const serviceMocks = vi.hoisted(() => ({
  getAllDayDefaultTime: vi.fn(),
}));

vi.mock('@/app/application', () => ({
  getApplicationServices: () =>
    Promise.resolve({
      reminders: {
        getAllDayDefaultTime: serviceMocks.getAllDayDefaultTime,
      },
    }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads the all-day reminder default after an application commit', async () => {
    serviceMocks.getAllDayDefaultTime
      .mockResolvedValueOnce('08:30')
      .mockResolvedValueOnce('09:00');
    render(<SettingsPage />);

    expect(await screen.findByLabelText('全天事项默认提醒时间')).toHaveValue('08:30');

    act(() => notifyApplicationChanged());

    await waitFor(() =>
      expect(screen.getByLabelText('全天事项默认提醒时间')).toHaveValue('09:00'),
    );
    expect(serviceMocks.getAllDayDefaultTime).toHaveBeenCalledTimes(2);
  });
});
