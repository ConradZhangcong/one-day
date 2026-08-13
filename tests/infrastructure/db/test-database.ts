import Dexie from 'dexie';

import { instantSchema, type Instant } from '../../../src/domain';
import { OneDayDatabase, ensureInbox } from '../../../src/infrastructure/db';

export interface TestDatabaseContext {
  db: OneDayDatabase;
  name: string;
  now: Instant;
  cleanup(): Promise<void>;
}

let sequence = 0;

export async function createTestDatabase(options?: {
  initializeInbox?: boolean;
}): Promise<TestDatabaseContext> {
  sequence += 1;
  const name = `one-day-test-${Date.now()}-${sequence}`;
  const now = instantSchema.parse('2026-08-13T01:00:00Z');
  const db = new OneDayDatabase(name);
  await db.open();

  if (options?.initializeInbox ?? true) {
    await ensureInbox(db);
  }

  const context: TestDatabaseContext = {
    db,
    name,
    now,
    async cleanup() {
      context.db.close();
      await Dexie.delete(name);
    },
  };

  return context;
}
