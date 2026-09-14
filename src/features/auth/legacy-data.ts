import Dexie from 'dexie';
import { BackupService } from '@/application';
import { DATABASE_NAME, DexieUnitOfWork, openOneDayDatabase } from '@/infrastructure/db';
import type { OneDayBackupV1 } from '@/domain';

/** Read-only inspection: keep the original browser database after either choice. */
export async function readLegacyBackup(): Promise<OneDayBackupV1 | undefined> {
  if (!(await Dexie.exists(DATABASE_NAME))) return undefined;
  const db = await openOneDayDatabase();
  try {
    const backup = await new BackupService(new DexieUnitOfWork(db)).createExport();
    const data = backup.data;
    return data.singleTasks.length ||
      data.recurrenceSeries.length ||
      data.longTermGoals.length ||
      data.lists.length > 1 ||
      data.tags.length
      ? backup
      : undefined;
  } finally {
    db.close();
  }
}
