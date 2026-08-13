import { describe, expect, it } from 'vitest';

import { INBOX_LIST_ID, ensureInbox } from '../../../src/infrastructure/db';
import { createTestDatabase } from './test-database';

describe('system inbox', () => {
  it('rejects an existing reserved row that is not canonical', async () => {
    const context = await createTestDatabase({ initializeInbox: false });
    try {
      await context.db.lists.add({
        id: INBOX_LIST_ID,
        name: '伪收件箱',
        order: 99,
        archived: true,
        archivedValue: 1,
        isSystem: false,
      });

      await expect(ensureInbox(context.db)).rejects.toThrow('not canonical');
    } finally {
      await context.cleanup();
    }
  });
});
