import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadServerConfig } from '../../server/config';

const directory = mkdtempSync(join(tmpdir(), 'one-day-config-'));
const path = join(directory, '.env');

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('server configuration', () => {
  it('explains how to create a missing .env file', () => {
    expect(() => loadServerConfig(path)).toThrow('请复制 .env.example 为 .env');
  });

  it('names a missing required setting', () => {
    writeFileSync(path, 'ONE_DAY_ORIGIN=http://localhost:53028\n');
    expect(() => loadServerConfig(path)).toThrow('ONE_DAY_DATABASE');
  });

  it('loads the listen address and database path from the file', () => {
    writeFileSync(
      path,
      'ONE_DAY_ORIGIN=http://localhost:54000\nONE_DAY_DATABASE=data/test.sqlite\nHOST=127.0.0.1\nPORT=54000\n',
    );
    expect(loadServerConfig(path)).toEqual({
      origin: 'http://localhost:54000',
      databasePath: join(process.cwd(), 'data/test.sqlite'),
      host: '127.0.0.1',
      port: 54000,
    });
  });
});
