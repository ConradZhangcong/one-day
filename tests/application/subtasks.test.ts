import { describe, expect, it } from 'vitest';
import { BackupService, TodoService } from '../../src/application';
import { decodeTimeZoneId, subtasksSchema, type TaskDraft } from '../../src/domain';
import {
  AccountUnitOfWork,
  emptyAccountData,
} from '../../src/infrastructure/account/unit-of-work';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

const draft: TaskDraft = {
  title: '主任务',
  notes: '',
  listId: 'system:inbox',
  tagNames: [],
  priority: 'none',
  plannedAt: { kind: 'none' },
  deadlineAt: { kind: 'none' },
};
const subtasks = [
  { id: 's1', title: '子项一', completed: false },
  { id: 's2', title: '子项二', completed: true },
];

describe('subtask persistence', () => {
  for (const backend of ['dexie', 'account'] as const) {
    it(`preserves subitems across edits, state changes and backup restore (${backend})`, async () => {
      const context = await createTestDatabase();
      try {
        const uow =
          backend === 'dexie'
            ? new DexieUnitOfWork(context.db)
            : new AccountUnitOfWork(emptyAccountData(decodeTimeZoneId('Asia/Shanghai')));
        await uow.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
        const todos = new TodoService(uow);
        const legacy = await todos.createTask(draft);
        expect(legacy.subtasks).toBeUndefined();
        const task = await todos.updateTask(legacy.id, { ...draft, subtasks });
        expect(task.subtasks).toEqual(subtasks);
        expect(
          (await todos.updateTask(task.id, { ...draft, title: '改标题' })).subtasks,
        ).toEqual(subtasks);
        const allDone = subtasks.map((item) => ({ ...item, completed: true }));
        expect(
          (await todos.updateTask(task.id, { ...draft, subtasks: allDone })).state,
        ).toBe('pending');
        await todos.updateTask(task.id, { ...draft, subtasks });
        expect((await todos.setTaskState(task.id, 'completed')).subtasks).toEqual(
          subtasks,
        );
        expect((await todos.undoTaskCompletion(task.id)).subtasks).toEqual(subtasks);
        await todos.rescheduleTask(task.id, { plannedAt: { kind: 'none' } });
        const backups = new BackupService(uow);
        const exported = await backups.createExport();
        await todos.deleteTask(task.id);
        await backups.restore(backups.inspect(JSON.stringify(exported)));
        expect((await todos.snapshot()).tasks[0]?.subtasks).toEqual(subtasks);
        await todos.updateTask(task.id, { ...draft, subtasks: [] });
        expect((await todos.snapshot()).tasks[0]?.subtasks).toEqual([]);
      } finally {
        await context.cleanup();
      }
    });
  }
  it('rejects duplicate IDs, blank titles and independent scheduling', () => {
    expect(subtasksSchema.safeParse([subtasks[0], subtasks[0]]).success).toBe(false);
    expect(subtasksSchema.safeParse([{ ...subtasks[0], title: ' ' }]).success).toBe(
      false,
    );
    expect(
      subtasksSchema.safeParse([{ ...subtasks[0], plannedAt: { kind: 'none' } }]).success,
    ).toBe(false);
  });
});
