import zhCN from 'antd/locale/zh_CN';
import { App, ConfigProvider, theme } from 'antd';
import { useSyncExternalStore, type PropsWithChildren } from 'react';

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

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: prefersDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: prefersDarkMode ? '#e5e5e5' : '#171717',
          colorInfo: prefersDarkMode ? '#b5b5b5' : '#525252',
          colorWarning: prefersDarkMode ? '#b5b5b5' : '#525252',
          colorBgBase: prefersDarkMode ? '#0a0a0a' : '#ffffff',
          colorTextBase: prefersDarkMode ? '#fafafa' : '#0a0a0a',
          colorBorder: prefersDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e5e5e5',
          borderRadius: 10,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
