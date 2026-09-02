import { describe, expect, it } from 'vitest';

import { decodeOneDayBackup, DomainErrorCode } from '../../src/domain';
import { createMinimalBackup } from '../backup-fixtures';
import { createSeries, createSingleTask } from '../infrastructure/db/fixtures';

describe('backup v1 contract', () => {
  it('decodes the stable envelope and a closed minimal data graph', () => {
    const backup = createMinimalBackup();
    expect(backup).toMatchObject({
      format: 'one-day-backup',
      version: 1,
      timeZone: 'Asia/Shanghai',
    });
  });

  it('distinguishes foreign formats and unsupported versions', () => {
    const backup = createMinimalBackup();
    expect(() => decodeOneDayBackup({ ...backup, format: 'foreign' })).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_FORMAT }),
    );
    expect(() => decodeOneDayBackup({ ...backup, version: 2 })).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_UNSUPPORTED_VERSION }),
    );
  });

  it('rejects duplicate identities, time-zone disagreement and dangling references', () => {
    const backup = createMinimalBackup();
    const inbox = backup.data.lists[0];
    expect(inbox).toBeDefined();
    expect(() =>
      decodeOneDayBackup({
        ...backup,
        data: { ...backup.data, lists: [inbox, inbox] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_DATA }),
    );
    expect(() =>
      decodeOneDayBackup({ ...backup, timeZone: 'Europe/Paris' }),
    ).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_DATA }),
    );
    expect(() =>
      decodeOneDayBackup({
        ...backup,
        data: {
          ...backup.data,
          singleTasks: [createSingleTask({ listId: 'missing:list' })],
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_DATA }),
    );
  });

  it('rejects tag names that collide at the persisted normalized index', () => {
    const backup = createMinimalBackup();
    expect(() =>
      decodeOneDayBackup({
        ...backup,
        data: {
          ...backup.data,
          tags: [
            { id: 'tag:one', name: '客户', color: 'blue' },
            { id: 'tag:two', name: ' 客户 ', color: 'green' },
          ],
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_DATA }),
    );
  });

  it('requires live series to own exactly their pending active occurrence', () => {
    const backup = createMinimalBackup();
    const { series, occurrence } = createSeries();
    expect(() =>
      decodeOneDayBackup({
        ...backup,
        data: { ...backup.data, recurrenceSeries: [series] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: DomainErrorCode.BACKUP_INVALID_DATA }),
    );
    expect(
      decodeOneDayBackup({
        ...backup,
        data: {
          ...backup.data,
          recurrenceSeries: [series],
          occurrenceRecords: [occurrence],
        },
      }).data.occurrenceRecords,
    ).toEqual([occurrence]);
  });
});
