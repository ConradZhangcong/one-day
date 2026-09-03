import type { Dispatch, SetStateAction } from 'react';

const setState: Dispatch<SetStateAction<boolean>> = () => undefined;

export function useRegisterSW() {
  return {
    offlineReady: [false, setState] as const,
    needRefresh: [false, setState] as const,
    updateServiceWorker: () => Promise.resolve(),
  };
}
