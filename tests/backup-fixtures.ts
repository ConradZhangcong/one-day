import { decodeOneDayBackup, type OneDayBackupV1 } from '../src/domain';

export function createMinimalBackup(): OneDayBackupV1 {
  return decodeOneDayBackup({
    format: 'one-day-backup',
    version: 1,
    exportedAt: '2026-09-02T01:02:03Z',
    timeZone: 'Asia/Shanghai',
    data: {
      singleTasks: [],
      recurrenceSeries: [],
      occurrenceRecords: [],
      lists: [
        {
          id: 'system:inbox',
          name: '收件箱',
          order: 0,
          archived: false,
          isSystem: true,
        },
      ],
      tags: [],
      reminders: [],
      longTermGoals: [],
      settings: { applicationTimeZone: 'Asia/Shanghai' },
    },
  });
}
