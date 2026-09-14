import { AuthGate } from '@/features/auth/AuthGate';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from '@/app/AppProviders';
import { router } from '@/app/router';

import '@/app/styles.css';
import '@/app/prototype-theme.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('缺少应用根节点 #root');
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </AppProviders>
  </StrictMode>,
);
