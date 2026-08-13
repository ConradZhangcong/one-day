import { describe, expect, it } from 'vitest';

import { ReminderService, TodoService } from '../../src/application';
import { decodeInstant, decodeLocalTime, decodeSchedulePoint } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createSingleTask } from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('ReminderService', () => {
  it('validates the referenced target and revises snooze identity', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.singleTasks.save(
        createSingleTask({ id: 'task:reminder' }),
      );
      const service = new ReminderService(unitOfWork, () => 'one');
      const reminder = await service.create({
        ownerKind: 'task',
        ownerId: 'task:reminder',
        target: 'planned',
        offsetMinutes: 15,
      });
      expect(reminder.scheduleRevision).toBe(0);
      const snoozed = await service.snooze(
        reminder.id,
        decodeInstant('2026-08-13T02:00:00Z'),
      );
      expect(snoozed).toMatchObject({
        snoozeRevision: 1,
        snoozedUntil: '2026-08-13T02:00:00Z',
      });
      const changed = await service.update(reminder.id, {
        target: 'deadline',
        offsetMinutes: 5,
      });
      expect(changed.scheduleRevision).toBe(1);
      expect('snoozedUntil' in changed).toBe(false);
    } finally {
      await context.cleanup();
    }
  });

  it('stores the all-day default through the settings boundary', async () => {
    const context = await createTestDatabase();
    try {
      const service = new ReminderService(new DexieUnitOfWork(context.db));
      expect(await service.getAllDayDefaultTime()).toBe('09:00');
      await service.setAllDayDefaultTime(decodeLocalTime('08:15'));
      expect(await service.getAllDayDefaultTime()).toBe('08:15');
    } finally {
      await context.cleanup();
    }
  });

  it('revises only real schedule changes and deletes owned reminders atomically', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      const task = createSingleTask({ id: 'task:lifecycle' });
      await unitOfWork.repositories.singleTasks.save(task);
      const reminders = new ReminderService(unitOfWork, () => 'lifecycle');
      const reminder = await reminders.create({
        ownerKind: 'task',
        ownerId: task.id,
        target: 'planned',
        offsetMinutes: 0,
      });
      await reminders.snooze(reminder.id, decodeInstant('2026-08-14T02:00:00Z'));
      const todos = new TodoService(unitOfWork, {
        now: () => '2026-08-13T02:00:00Z',
        detectTimeZone: () => 'Asia/Shanghai',
      });

      await todos.rescheduleTask(task.id, { plannedAt: task.plannedAt });
      expect(await reminders.list('task', task.id)).toMatchObject([
        { scheduleRevision: 0, snoozeRevision: 1 },
      ]);
      await todos.rescheduleTask(task.id, {
        plannedAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-15' }),
        deadlineAt: decodeSchedulePoint({ kind: 'allDay', date: '2026-08-16' }),
      });
      const revised = (await reminders.list('task', task.id))[0];
      expect(revised?.scheduleRevision).toBe(1);
      expect(revised && 'snoozedUntil' in revised).toBe(false);

      await todos.deleteTask(task.id);
      expect(await reminders.list('task', task.id)).toEqual([]);
    } finally {
      await context.cleanup();
    }
  });
});
