import {
  recurrenceSeriesSchema,
  singleTaskSchema,
  taskListSchema,
  DomainError,
  DomainErrorCode,
  type TaskList,
} from '../../domain';
import type { DeleteListResult } from '../../application/repositories';

import type { OneDayDatabase } from './database';
import {
  fromListRecord,
  fromRecurrenceSeriesRecord,
  fromSingleTaskRecord,
  toRecurrenceSeriesRecord,
  toSingleTaskRecord,
} from './projections';
import { INBOX_LIST_ID } from './system-data';
import { decodeInboxList } from './system-data';

/**
 * Deletes a custom list and atomically re-homes every owning entity. The inbox
 * itself is protected because losing it would invalidate the default-list
 * invariant throughout the application.
 */
export async function deleteListAndMoveContentsToInbox(
  db: OneDayDatabase,
  listId: TaskList['id'],
): Promise<DeleteListResult> {
  if (listId === INBOX_LIST_ID) {
    throw new DomainError(
      DomainErrorCode.SYSTEM_LIST_IMMUTABLE,
      'The system inbox cannot be deleted.',
    );
  }

  return db.transaction(
    'rw',
    [db.lists, db.singleTasks, db.recurrenceSeries],
    async () => {
      const [list, inbox] = await Promise.all([
        db.lists.get(listId),
        db.lists.get(INBOX_LIST_ID),
      ]);

      if (list === undefined) {
        throw new DomainError(
          DomainErrorCode.LIST_NOT_FOUND,
          `List does not exist: ${listId}`,
        );
      }

      if (inbox === undefined) {
        throw new TypeError('The system inbox must exist before deleting a list.');
      }
      decodeInboxList(fromListRecord(inbox));

      const [singleTaskRecords, seriesRecords] = await Promise.all([
        db.singleTasks.toArray(),
        db.recurrenceSeries.toArray(),
      ]);

      const decodedTasks = singleTaskRecords.map((record) =>
        singleTaskSchema.parse(fromSingleTaskRecord(record)),
      );
      const decodedSeries = seriesRecords.map((record) =>
        recurrenceSeriesSchema.parse(fromRecurrenceSeriesRecord(record)),
      );
      const singleTasks = decodedTasks
        .filter((task) => task.listId === listId)
        .map((task) => {
          return toSingleTaskRecord({
            ...task,
            listId: INBOX_LIST_ID,
          });
        });
      const recurrenceSeries = decodedSeries
        .filter((series) => series.template.listId === listId)
        .map((series) => {
          return toRecurrenceSeriesRecord({
            ...series,
            template: {
              ...series.template,
              listId: INBOX_LIST_ID,
            },
          });
        });

      if (singleTasks.length > 0) {
        await db.singleTasks.bulkPut(singleTasks);
      }
      if (recurrenceSeries.length > 0) {
        await db.recurrenceSeries.bulkPut(recurrenceSeries);
      }

      await db.lists.delete(taskListSchema.parse(fromListRecord(list)).id);

      return {
        movedSingleTaskCount: singleTasks.length,
        movedRecurrenceSeriesCount: recurrenceSeries.length,
      };
    },
  );
}
