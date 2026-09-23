import { describe, expect, it } from 'vitest';
import {
  BackupService,
  GoalService,
  RecurrenceService,
  TodoService,
} from '../../src/application';
import { decodeLocalDate, decodeTimeZoneId, type TaskDraft } from '../../src/domain';
import {
  AccountUnitOfWork,
  emptyAccountData,
} from '../../src/infrastructure/account/unit-of-work';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

const now = () => '2026-09-22T02:00:00Z';
const draft: TaskDraft = {
  title: '长期阅读',
  notes: '持续积累',
  listId: 'system:inbox',
  tagNames: [],
  priority: 'none',
  plannedAt: { kind: 'none' },
  deadlineAt: { kind: 'none' },
};

describe('unified tasks', () => {
  for (const backend of ['account', 'dexie'] as const) {
    it(`merges legacy goals without losing links, preserves backups and supports pause/resume (${backend})`, async () => {
      const context = await createTestDatabase();
      try {
        const unit =
          backend === 'account'
            ? new AccountUnitOfWork(emptyAccountData(decodeTimeZoneId('Asia/Shanghai')))
            : new DexieUnitOfWork(context.db);
        await unit.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
        const goals = new GoalService(unit, () => 'legacy', now);
        const legacy = await goals.create({
          title: '原目标',
          description: '原说明',
          status: 'archived',
        });
        const todos = new TodoService(unit, { now });
        // An existing link to an archived legacy goal must survive conversion.
        const linked = await todos.createTask(draft);
        await unit.repositories.singleTasks.save({ ...linked, goalId: legacy.id });
        const snapshot = await todos.unifiedSnapshot();
        expect(snapshot.tasks.find((task) => task.id === legacy.id)).toMatchObject({
          title: '原目标',
          notes: '原说明',
          paused: true,
          state: 'pending',
        });
        expect(snapshot.tasks.find((task) => task.id === linked.id)?.goalId).toBe(
          legacy.id,
        );
        expect(await unit.repositories.longTermGoals.getAll()).toEqual([]);
        expect((await todos.unifiedSnapshot()).tasks).toHaveLength(2);
        await todos.setTaskPaused(legacy.id, false);
        expect(
          (await todos.snapshot()).tasks.find((task) => task.id === legacy.id)?.paused,
        ).toBe(false);
        await todos.setTaskPaused(legacy.id, true);
        const backup = new BackupService(unit);
        const exported = await backup.createExport();
        await todos.setTaskPaused(legacy.id, false);
        await backup.restore(backup.inspect(JSON.stringify(exported)));
        expect(
          (await todos.snapshot()).tasks.find((task) => task.id === legacy.id)?.paused,
        ).toBe(true);
        await todos.updateTask(legacy.id, {
          ...draft,
          plannedAt: { kind: 'allDay', date: decodeLocalDate('2026-09-23') },
        });
        const timed = (await todos.snapshot()).tasks.find(
          (task) => task.id === legacy.id,
        )!;
        expect(timed.paused).toBe(false);
        await expect(todos.setTaskPaused(legacy.id, true)).rejects.toThrow();
        await todos.updateTask(legacy.id, draft);
        await todos.setTaskPaused(legacy.id, true);
        await todos.setTaskPaused(legacy.id, false);
        await todos.setTaskState(legacy.id, 'completed');
        await todos.undoTaskCompletion(legacy.id);
        expect(
          (await todos.snapshot()).tasks.find((task) => task.id === legacy.id)?.state,
        ).toBe('pending');
      } finally {
        await context.cleanup();
      }
    });
  }

  it('validates task links and retains linked work when a parent is deleted', async () => {
    const unit = new AccountUnitOfWork(emptyAccountData(decodeTimeZoneId('UTC')));
    const todos = new TodoService(unit, { now });
    const parent = await todos.createTask(draft);
    const child = await todos.createTask({ ...draft, goalId: parent.id });
    await expect(
      todos.updateTask(parent.id, { ...draft, goalId: child.id }),
    ).rejects.toThrow('循环');
    await expect(
      todos.updateTask(parent.id, { ...draft, goalId: parent.id }),
    ).rejects.toThrow('循环');
    const recurrence = new RecurrenceService(unit, { now });
    const series = await recurrence.createSeries({
      ...draft,
      goalId: parent.id,
      plannedAt: { kind: 'allDay', date: '2026-09-22' },
      rule: { frequency: 'daily', interval: 1 },
    });
    const backup = new BackupService(unit);
    expect(() => backup.inspect(JSON.stringify({}))).toThrow();
    const exported = await backup.createExport();
    expect(backup.inspect(JSON.stringify(exported))).toBeDefined();
    await todos.deleteTask(parent.id);
    expect(
      (await todos.snapshot()).tasks.find((task) => task.id === child.id)?.goalId,
    ).toBeUndefined();
    expect(
      (await unit.repositories.recurrenceSeries.get(series.id))?.template.goalId,
    ).toBeUndefined();
    expect((await todos.snapshot()).tasks).toHaveLength(1);
    expect(backup.inspect(JSON.stringify(await backup.createExport()))).toBeDefined();
  });
});
