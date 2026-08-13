import { taskListSchema, type TaskList } from '../../domain';

import type { OneDayDatabase } from './database';
import { fromListRecord, toListRecord } from './projections';

export const INBOX_LIST_ID = 'system:inbox';

export function createInboxList(): TaskList {
  return taskListSchema.parse({
    id: INBOX_LIST_ID,
    name: '收件箱',
    order: 0,
    archived: false,
    isSystem: true,
  });
}

export function decodeInboxList(input: unknown): TaskList {
  const inbox = taskListSchema.parse(input);
  if (
    inbox.id !== INBOX_LIST_ID ||
    !inbox.isSystem ||
    inbox.archived ||
    inbox.order !== 0 ||
    inbox.name !== '收件箱'
  ) {
    throw new TypeError('The persisted system inbox is not canonical.');
  }
  return inbox;
}

/**
 * Idempotently creates the immutable system inbox without overwriting data from
 * an existing installation.
 */
export async function ensureInbox(db: OneDayDatabase): Promise<TaskList> {
  return db.transaction('rw', db.lists, async () => {
    const existing = await db.lists.get(INBOX_LIST_ID);
    if (existing !== undefined) {
      return decodeInboxList(fromListRecord(existing));
    }

    const inbox = createInboxList();
    await db.lists.add(toListRecord(inbox));
    return inbox;
  });
}
