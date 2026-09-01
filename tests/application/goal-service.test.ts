import { describe, expect, it } from 'vitest';

import { GoalService, TodoService } from '../../src/application';
import { DexieUnitOfWork, INBOX_LIST_ID } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('GoalService', () => {
  it('calculates progress from linked task lifecycle state', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      let id = 0;
      let minute = 0;
      const now = () => `2026-08-13T01:${String(minute++).padStart(2, '0')}:00Z`;
      const goals = new GoalService(unitOfWork, () => String(++id), now);
      const todos = new TodoService(unitOfWork, {
        createId: () => String(++id),
        now,
        detectTimeZone: () => 'Asia/Shanghai',
      });
      const goal = await goals.create({
        title: '完成作品集',
        description: '发布一个可访问版本',
        status: 'active',
      });
      const createTask = (title: string) =>
        todos.createTask({
          title,
          notes: '',
          listId: INBOX_LIST_ID,
          tagNames: [],
          priority: 'none',
          plannedAt: { kind: 'none' },
          deadlineAt: { kind: 'none' },
          goalId: goal.id,
        });
      const first = await createTask('整理案例');
      await createTask('发布网站');
      await todos.setTaskState(first.id, 'completed');

      await expect(goals.snapshot()).resolves.toMatchObject([
        { completedTasks: 1, totalTasks: 2, percent: 50 },
      ]);
      await todos.undoTaskCompletion(first.id);
      await expect(goals.snapshot()).resolves.toMatchObject([
        { completedTasks: 0, totalTasks: 2, percent: 0 },
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it('rejects assigning a task to an archived goal', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      const goals = new GoalService(
        unitOfWork,
        () => 'archived',
        () => context.now,
      );
      const goal = await goals.create({
        title: '旧目标',
        description: '',
        status: 'archived',
      });
      const todos = new TodoService(unitOfWork, {
        createId: () => 'task',
        now: () => context.now,
        detectTimeZone: () => 'Asia/Shanghai',
      });
      await expect(
        todos.createTask({
          title: '不应关联',
          notes: '',
          listId: INBOX_LIST_ID,
          tagNames: [],
          priority: 'none',
          plannedAt: { kind: 'none' },
          deadlineAt: { kind: 'none' },
          goalId: goal.id,
        }),
      ).rejects.toMatchObject({ code: 'ARCHIVED_GOAL' });
    } finally {
      await context.cleanup();
    }
  });

  it('allows an existing archived goal link to be preserved or cleared', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      let id = 0;
      const goals = new GoalService(
        unitOfWork,
        () => String(++id),
        () => context.now,
      );
      const todos = new TodoService(unitOfWork, {
        createId: () => String(++id),
        now: () => context.now,
        detectTimeZone: () => 'Asia/Shanghai',
      });
      const goal = await goals.create({
        title: '阶段目标',
        description: '',
        status: 'active',
      });
      const task = await todos.createTask({
        title: '保留关联',
        notes: '',
        listId: INBOX_LIST_ID,
        tagNames: [],
        priority: 'none',
        plannedAt: { kind: 'none' },
        deadlineAt: { kind: 'none' },
        goalId: goal.id,
      });
      await goals.update(goal.id, {
        title: goal.title,
        description: goal.description,
        status: 'archived',
      });
      await expect(
        todos.updateTask(task.id, {
          title: task.title,
          notes: task.notes,
          listId: task.listId,
          tagNames: [],
          priority: task.priority,
          plannedAt: task.plannedAt,
          deadlineAt: task.deadlineAt,
          goalId: goal.id,
        }),
      ).resolves.toMatchObject({ goalId: goal.id });
      await expect(
        todos.updateTask(task.id, {
          title: task.title,
          notes: task.notes,
          listId: task.listId,
          tagNames: [],
          priority: task.priority,
          plannedAt: task.plannedAt,
          deadlineAt: task.deadlineAt,
        }),
      ).resolves.not.toHaveProperty('goalId');
    } finally {
      await context.cleanup();
    }
  });
});
