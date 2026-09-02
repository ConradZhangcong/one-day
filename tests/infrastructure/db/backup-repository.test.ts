import { describe, expect, it } from 'vitest';

import { backupDataV1Schema, tagSchema } from '../../../src/domain';
import { DexieUnitOfWork } from '../../../src/infrastructure/db';
import { createMinimalBackup } from '../../backup-fixtures';
import { createSingleTask } from './fixtures';
import { createTestDatabase } from './test-database';

describe('Dexie backup repository', () => {
  it('reads a decoded consistent snapshot and rebuilds indexed records', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      const oldTask = createSingleTask({ id: 'task:old' });
      await unitOfWork.repositories.singleTasks.save(oldTask);
      expect(await unitOfWork.repositories.backup.readSnapshot()).toMatchObject({
        singleTasks: [{ id: 'task:old' }],
        settings: { applicationTimeZone: 'Asia/Shanghai' },
      });

      const replacement = backupDataV1Schema.parse({
        ...createMinimalBackup().data,
        singleTasks: [createSingleTask({ id: 'task:new', title: '新的任务' })],
      });
      await unitOfWork.write(({ backup }) => backup.replaceAll(replacement));

      await expect(context.db.singleTasks.get('task:old')).resolves.toBeUndefined();
      await expect(context.db.singleTasks.get('task:new')).resolves.toMatchObject({
        normalizedTitle: '新的任务',
        plannedLocalDate: '2026-08-14',
      });
      await expect(unitOfWork.repositories.backup.readSnapshot()).resolves.toEqual(
        replacement,
      );
    } finally {
      await context.cleanup();
    }
  });

  it('rolls back every cleared and written table when a later write fails', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(createSingleTask({ id: 'keep' }));
      const before = await Promise.all(context.db.tables.map((table) => table.toArray()));
      const duplicateNames = [
        tagSchema.parse({ id: 'tag:one', name: '客户', color: 'blue' }),
        tagSchema.parse({ id: 'tag:two', name: '客户', color: 'green' }),
      ];
      const invalidForUniqueIndex = backupDataV1Schema.parse({
        ...createMinimalBackup().data,
        tags: duplicateNames,
      });

      await expect(
        unitOfWork.write(({ backup }) => backup.replaceAll(invalidForUniqueIndex)),
      ).rejects.toBeDefined();
      const after = await Promise.all(context.db.tables.map((table) => table.toArray()));
      expect(after).toEqual(before);
    } finally {
      await context.cleanup();
    }
  });
});
