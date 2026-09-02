import type { BackupDataV1 } from '../../domain';

export interface BackupRepository {
  /** Reads all recoverable domain data from one consistent storage snapshot. */
  readSnapshot(): Promise<BackupDataV1>;
  /** Replaces all persisted data. The caller must provide the encompassing transaction. */
  replaceAll(data: BackupDataV1): Promise<void>;
}
