import { describe, expect, it, vi } from 'vitest';

import {
  ReminderRuntime,
  ReminderService,
  type ReminderDelivery,
} from '../../src/application';
import { decodeSchedulePoint } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createSingleTask } from '../infrastructure/db/fixtures';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('ReminderRuntime', () => {
  it('claims a due delivery once across concurrent reconciliation and reload', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(
        createSingleTask({
          id: 'task:due',
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T09:00',
          }),
          deadlineAt: { kind: 'none' },
        }),
      );
      await new ReminderService(unitOfWork, () => 'due').create({
        ownerKind: 'task',
        ownerId: 'task:due',
        target: 'planned',
        offsetMinutes: 0,
      });
      const delivered: string[] = [];
      const dependencies = {
        now: () => '2026-08-13T01:00:00Z',
        isVisible: () => true,
        deliver: ({ trigger }: ReminderDelivery) => {
          delivered.push(trigger.deliveryKey);
        },
      };
      const first = new ReminderRuntime(unitOfWork, dependencies);
      await Promise.all([first.reconcile(), first.reconcile(), first.reconcile()]);
      const reloaded = new ReminderRuntime(unitOfWork, dependencies);
      await reloaded.reconcile();
      expect(delivered).toHaveLength(1);
    } finally {
      await context.cleanup();
    }
  });

  it('includes exactly 15 minutes in recovery and drops older notifications', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.saveMany([
        createSingleTask({
          id: 'task:edge',
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T09:00',
          }),
          deadlineAt: { kind: 'none' },
        }),
        createSingleTask({
          id: 'task:old',
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T08:59',
          }),
          deadlineAt: { kind: 'none' },
        }),
      ]);
      const service = new ReminderService(
        unitOfWork,
        (() => {
          let id = 0;
          return () => String(++id);
        })(),
      );
      await service.create({
        ownerKind: 'task',
        ownerId: 'task:edge',
        target: 'planned',
        offsetMinutes: 0,
      });
      await service.create({
        ownerKind: 'task',
        ownerId: 'task:old',
        target: 'planned',
        offsetMinutes: 0,
      });
      const delivered: string[] = [];
      await new ReminderRuntime(unitOfWork, {
        now: () => '2026-08-13T01:15:00Z',
        isVisible: () => true,
        deliver: ({ reminder }) => {
          delivered.push(reminder.ownerId);
        },
      }).reconcile();
      expect(delivered).toEqual(['task:edge']);
    } finally {
      await context.cleanup();
    }
  });

  it('does not fire early and reconciles a forward clock jump on focus', async () => {
    const context = await createTestDatabase();
    try {
      const unitOfWork = new DexieUnitOfWork(context.db);
      await unitOfWork.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
      await unitOfWork.repositories.singleTasks.save(
        createSingleTask({
          id: 'task:clock',
          plannedAt: decodeSchedulePoint({
            kind: 'timed',
            localDateTime: '2026-08-13T09:00',
          }),
          deadlineAt: { kind: 'none' },
        }),
      );
      await new ReminderService(unitOfWork, () => 'clock').create({
        ownerKind: 'task',
        ownerId: 'task:clock',
        target: 'planned',
        offsetMinutes: 0,
      });
      let now = '2026-08-13T00:59:59Z';
      let timerCallback: (() => void) | undefined;
      let timerDelay = -1;
      const delivered: string[] = [];
      const runtime = new ReminderRuntime(unitOfWork, {
        now: () => now,
        isVisible: () => true,
        setTimer: (callback, delay) => {
          timerCallback = callback;
          timerDelay = delay;
          return 1;
        },
        clearTimer: () => undefined,
        deliver: ({ reminder }) => {
          delivered.push(reminder.ownerId);
        },
      });
      try {
        runtime.start();
        await runtime.reconcile();
        expect(timerDelay).toBe(1_000);
        timerCallback?.();
        await runtime.reconcile();
        expect(delivered).toEqual([]);

        now = '2026-08-13T01:00:30Z';
        window.dispatchEvent(new Event('focus'));
        await vi.waitFor(() => expect(delivered).toEqual(['task:clock']));
      } finally {
        runtime.stop();
      }
    } finally {
      await context.cleanup();
    }
  });
});
