import type { Plugin } from 'vite';
import { createAccountApi } from './api';

export function accountApiPlugin(): Plugin {
  return {
    name: 'one-day-account-api',
    configureServer(server) {
      const api = createAccountApi({
        secureCookies: process.env.ONE_DAY_ORIGIN?.startsWith('https://') ?? false,
      });
      server.middlewares.use('/api', (req, res) => {
        req.url = `/api${req.url ?? ''}`;
        api.handle(req, res);
      });
      server.httpServer?.once('close', api.close);
    },
    configurePreviewServer(server) {
      const api = createAccountApi({
        secureCookies: process.env.ONE_DAY_ORIGIN?.startsWith('https://') ?? false,
      });
      server.middlewares.use('/api', (req, res) => {
        req.url = `/api${req.url ?? ''}`;
        api.handle(req, res);
      });
      server.httpServer.once('close', api.close);
    },
  };
}
