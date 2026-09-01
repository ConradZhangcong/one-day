import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';

import { Toaster } from '@/components/ui/sonner';

const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

function subscribeToDarkMode(onChange: () => void) {
  const media = window.matchMedia(DARK_MODE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getDarkModeSnapshot() {
  return window.matchMedia(DARK_MODE_QUERY).matches;
}

export function AppProviders({ children }: PropsWithChildren) {
  const prefersDarkMode = useSyncExternalStore(
    subscribeToDarkMode,
    getDarkModeSnapshot,
    () => false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefersDarkMode);
  }, [prefersDarkMode]);

  return (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  );
}
