import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useSettingsStore } from './stores/settingsStore';
import Layout from './components/common/Layout';
import TaskListPage from './pages/TaskList';
import CalendarPage from './pages/Calendar';
import JournalPage from './pages/Journal';
import SettingsPage from './pages/Settings';

function App() {
  const appTheme = useSettingsStore((state) => state.theme);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/tasks" replace />} />
            <Route path="tasks" element={<TaskListPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="journal/:date" element={<JournalPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;

