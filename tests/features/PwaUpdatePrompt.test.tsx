import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PwaUpdatePrompt } from '@/app/PwaUpdatePrompt';

const { updateServiceWorker, setNeedRefresh, toastInfo, toastDismiss } = vi.hoisted(
  () => ({
    updateServiceWorker: vi.fn(),
    setNeedRefresh: vi.fn(),
    toastInfo: vi.fn(),
    toastDismiss: vi.fn(),
  }),
);

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, setNeedRefresh],
    updateServiceWorker,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo,
    dismiss: toastDismiss,
  },
}));

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastInfo.mockReturnValue('pwa-update');
  });

  it('waits for explicit user action before activating the update', async () => {
    render(<PwaUpdatePrompt />);
    await waitFor(() => expect(toastInfo).toHaveBeenCalledOnce());
    expect(updateServiceWorker).not.toHaveBeenCalled();

    const options = toastInfo.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
      onDismiss: () => void;
    };
    options.onDismiss();
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();

    options.action.onClick();
    expect(updateServiceWorker).toHaveBeenCalledOnce();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses the persistent toast when unmounted', async () => {
    const view = render(<PwaUpdatePrompt />);
    await waitFor(() => expect(toastInfo).toHaveBeenCalledOnce());
    view.unmount();
    expect(toastDismiss).toHaveBeenCalledWith('pwa-update');
  });
});
