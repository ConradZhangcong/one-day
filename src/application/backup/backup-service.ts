import { Temporal } from 'temporal-polyfill';

import {
  decodeInstant,
  decodeOneDayBackup,
  DomainError,
  DomainErrorCode,
  ONE_DAY_BACKUP_FORMAT,
  ONE_DAY_BACKUP_VERSION,
  validateBackupGraph,
  type OneDayBackupV1,
} from '../../domain';
import type { UnitOfWork } from '../repositories';

export interface BackupSummary {
  readonly exportedAt: OneDayBackupV1['exportedAt'];
  readonly timeZone: OneDayBackupV1['timeZone'];
  readonly counts: {
    readonly singleTasks: number;
    readonly recurrenceSeries: number;
    readonly occurrenceRecords: number;
    readonly lists: number;
    readonly tags: number;
    readonly reminders: number;
    readonly longTermGoals: number;
  };
}

export interface BackupInspection {
  readonly backup: OneDayBackupV1;
  readonly summary: BackupSummary;
}

export interface BackupServiceDependencies {
  readonly now?: () => string;
  readonly onRestored?: () => void;
}

function summarize(backup: OneDayBackupV1): BackupSummary {
  const { data } = backup;
  return {
    exportedAt: backup.exportedAt,
    timeZone: backup.timeZone,
    counts: {
      singleTasks: data.singleTasks.length,
      recurrenceSeries: data.recurrenceSeries.length,
      occurrenceRecords: data.occurrenceRecords.length,
      lists: data.lists.length,
      tags: data.tags.length,
      reminders: data.reminders.length,
      longTermGoals: data.longTermGoals.length,
    },
  };
}

export class BackupService {
  private readonly now: () => string;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly dependencies: BackupServiceDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => Temporal.Now.instant().toString());
  }

  async createExport(): Promise<OneDayBackupV1> {
    const data = await this.unitOfWork.repositories.backup.readSnapshot();
    return decodeOneDayBackup({
      format: ONE_DAY_BACKUP_FORMAT,
      version: ONE_DAY_BACKUP_VERSION,
      exportedAt: decodeInstant(this.now()),
      timeZone: data.settings.applicationTimeZone,
      data,
    });
  }

  inspect(text: string): BackupInspection {
    let input: unknown;
    try {
      input = JSON.parse(text) as unknown;
    } catch {
      throw new DomainError(
        DomainErrorCode.BACKUP_INVALID_JSON,
        'Backup file is not valid JSON.',
      );
    }
    const backup = decodeOneDayBackup(input);
    return { backup, summary: summarize(backup) };
  }

  async restore(inspection: BackupInspection): Promise<BackupSummary> {
    const backup = validateBackupGraph(decodeOneDayBackup(inspection.backup));
    await this.unitOfWork.write(({ backup: repository }) =>
      repository.replaceAll(backup.data),
    );
    this.dependencies.onRestored?.();
    return summarize(backup);
  }
}
