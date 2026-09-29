import type { Plugin } from 'vite';
import { createAccountApi } from './api';
import type { ServerConfig } from './config';

export function accountApiPlugin(config: ServerConfig): Plugin {
  return {
    name: 'one-day-account-api',
    configureServer(server) {
      const api = createAccountApi({
        databasePath: config.databasePath,
        origin: config.origin,
        ...(config.adminPassword ? { adminPassword: config.adminPassword } : {}),
        secureCookies: config.origin.startsWith('https://'),
      });
      server.middlewares.use('/api', (req, res) => {
        req.url = `/api${req.url ?? ''}`;
        api.handle(req, res);
      });
      server.httpServer?.once('close', api.close);
    },
    configurePreviewServer(server) {
      const api = createAccountApi({
        databasePath: config.databasePath,
        origin: config.origin,
        ...(config.adminPassword ? { adminPassword: config.adminPassword } : {}),
        secureCookies: config.origin.startsWith('https://'),
      });
      server.middlewares.use('/api', (req, res) => {
        req.url = `/api${req.url ?? ''}`;
        api.handle(req, res);
      });
      server.httpServer.once('close', api.close);
    },
  };
}
