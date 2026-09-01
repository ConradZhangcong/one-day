import { createBrowserRouter, Navigate } from 'react-router';

import { AppShell } from './AppShell';
import { AppErrorPage } from './AppErrorPage';
import { TodoPage } from '@/features/todos/TodoPage';
import { RecoveryPage } from '@/features/recovery/RecoveryPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';

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
      { path: 'calendar/:view', element: <CalendarPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: '*', element: <AppErrorPage notFound /> },
    ],
  },
]);
