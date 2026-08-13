import { describe, expect, it } from 'vitest';

import { TodoService } from '../../src/application';
import { decodeSchedulePoint } from '../../src/domain';
import { DexieUnitOfWork, INBOX_LIST_ID } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

function createService(unitOfWork: DexieUnitOfWork) {
  let id = 0;
  let minute = 0;
  return new TodoService(unitOfWork, {
    createId: () => String(++id),
    now: () => `2026-08-13T01:${String(minute++).padStart(2, '0')}:00Z`,
    detectTimeZone: () => 'Asia/Shanghai',
  });
}

describe('TodoService', () => {
  it('creates, edits, completes and undoes a normal task through the unit of work', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      const list = await service.createList('工作');
      const task = await service.createTask({
        title: '准备周会',
        notes: '',
        listId: list.id,
        tagNames: ['会议', '  ＭＥＥＴＩＮＧ ', 'meeting'],
        priority: 'none',
        plannedAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' }),
        deadlineAt: decodeSchedulePoint({ kind: 'none' }),
      });

      expect(task.tagIds).toHaveLength(2);
      await expect(service.snapshot()).resolves.toMatchObject({
        tasks: [{ title: '准备周会', state: 'pending' }],
        tags: [{ name: '会议' }, { name: 'meeting' }],
      });

      const completed = await service.setTaskState(task.id, 'completed');
      expect(completed.state).toBe('completed');
      const pending = await service.undoTaskCompletion(task.id);
      expect(pending.state).toBe('pending');
      const skipped = await service.setTaskState(task.id, 'skipped');
      expect(skipped.state).toBe('skipped');
      await expect(service.undoTaskCompletion(task.id)).rejects.toMatchObject({
        code: 'TASK_ALREADY_HANDLED',
      });
    } finally {
      await context.cleanup();
    }
  });

  it('rejects an invalid schedule without creating a task or tag', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      await expect(
        service.createTask({
          title: '非法任务',
          notes: '',
          listId: INBOX_LIST_ID,
          tagNames: ['不应写入'],
          priority: 'high',
          plannedAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-15' }),
          deadlineAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' }),
        }),
      ).rejects.toMatchObject({ code: 'DEADLINE_BEFORE_PLAN' });
      await expect(service.snapshot()).resolves.toMatchObject({ tasks: [], tags: [] });
    } finally {
      await context.cleanup();
    }
  });

  it('manages custom lists while protecting the system inbox', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      const work = await service.createList('工作');
      const life = await service.createList('生活');
      await service.reorderList(life.id, -1);
      await service.updateList(work.id, { name: '工作事项', archived: true });

      const snapshot = await service.snapshot();
      expect(snapshot.lists.find((list) => list.id === work.id)).toMatchObject({
        name: '工作事项',
        archived: true,
      });
      expect(snapshot.lists.find((list) => list.id === life.id)?.order).toBeLessThan(
        snapshot.lists.find((list) => list.id === work.id)?.order ?? Infinity,
      );
      await expect(
        service.updateList(INBOX_LIST_ID, { archived: true }),
      ).rejects.toMatchObject({ code: 'SYSTEM_LIST_IMMUTABLE' });
      await expect(
        service.updateList(INBOX_LIST_ID, { name: '其他名称' }),
      ).rejects.toMatchObject({ code: 'SYSTEM_LIST_IMMUTABLE' });
      await expect(service.deleteList(INBOX_LIST_ID)).rejects.toMatchObject({
        code: 'SYSTEM_LIST_IMMUTABLE',
      });
    } finally {
      await context.cleanup();
    }
  });

  it('validates task ownership and command input before persisting', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      const draft = {
        title: '归属测试',
        notes: '',
        listId: 'list:missing',
        tagNames: [],
        priority: 'none' as const,
        plannedAt: decodeSchedulePoint({ kind: 'none' }),
        deadlineAt: decodeSchedulePoint({ kind: 'none' }),
      };

      await expect(service.createTask(draft)).rejects.toMatchObject({
        code: 'LIST_NOT_FOUND',
      });
      await expect(service.snapshot()).resolves.toMatchObject({ tasks: [] });

      await expect(
        service.createTask({
          ...draft,
          listId: INBOX_LIST_ID,
          // @ts-expect-error Runtime decoding must reject JavaScript callers too.
          priority: 'urgent',
        }),
      ).rejects.toMatchObject({ name: 'ZodError' });
      await expect(service.snapshot()).resolves.toMatchObject({ tasks: [] });
    } finally {
      await context.cleanup();
    }
  });

  it('serializes competing lifecycle commands so only one terminal action wins', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      const task = await service.createTask({
        title: '只能处理一次',
        notes: '',
        listId: INBOX_LIST_ID,
        tagNames: [],
        priority: 'none',
        plannedAt: decodeSchedulePoint({ kind: 'none' }),
        deadlineAt: decodeSchedulePoint({ kind: 'none' }),
      });

      const results = await Promise.allSettled([
        service.setTaskState(task.id, 'completed'),
        service.setTaskState(task.id, 'skipped'),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const stored = (await service.snapshot()).tasks[0];
      expect(stored?.state === 'completed' || stored?.state === 'skipped').toBe(true);
    } finally {
      await context.cleanup();
    }
  });

  it('does not let a concurrent edit revert a completed task to pending', async () => {
    const context = await createTestDatabase();
    try {
      const service = createService(new DexieUnitOfWork(context.db));
      const task = await service.createTask({
        title: '初始标题',
        notes: '',
        listId: INBOX_LIST_ID,
        tagNames: [],
        priority: 'none',
        plannedAt: decodeSchedulePoint({ kind: 'none' }),
        deadlineAt: decodeSchedulePoint({ kind: 'none' }),
      });

      await Promise.all([
        service.updateTask(task.id, {
          title: '更新后的标题',
          notes: '',
          listId: INBOX_LIST_ID,
          tagNames: [],
          priority: 'none',
          plannedAt: decodeSchedulePoint({ kind: 'none' }),
          deadlineAt: decodeSchedulePoint({ kind: 'none' }),
        }),
        service.setTaskState(task.id, 'completed'),
      ]);

      await expect(service.snapshot()).resolves.toMatchObject({
        tasks: [{ title: '更新后的标题', state: 'completed' }],
      });
    } finally {
      await context.cleanup();
    }
  });
});
