import { createBrowserRouter, Navigate } from 'react-router';

import { AppShell } from './AppShell';
import { AppErrorPage } from './AppErrorPage';
import { FoundationPage } from './FoundationPage';
import { TodoPage } from '@/features/todos/TodoPage';
import { RecoveryPage } from '@/features/recovery/RecoveryPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <Navigate replace to="/today" /> },
      { path: 'today', element: <TodoPage /> },
      { path: 'inbox', element: <TodoPage /> },
      { path: 'upcoming', element: <TodoPage /> },
      { path: 'completed', element: <TodoPage /> },
      { path: 'recovery', element: <RecoveryPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'lists/:listId', element: <TodoPage /> },
      { path: 'calendar/:view', element: <FoundationPage /> },
      { path: '*', element: <AppErrorPage notFound /> },
    ],
  },
]);
