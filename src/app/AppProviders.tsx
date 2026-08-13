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
          colorPrimary: '#17675d',
          colorInfo: '#17675d',
          colorWarning: '#c77728',
          colorBgBase: '#f7f3eb',
          borderRadius: 14,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
