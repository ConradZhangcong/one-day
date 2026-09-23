import { describe, expect, it } from 'vitest';
import {
  BackupService,
  CalendarService,
  OccurrenceQueryService,
  RecurrenceService,
  RecoveryService,
  TodoService,
} from '../../src/application';
import { decodeLocalDate, decodeTimeZoneId, occurrenceKeySchema } from '../../src/domain';
import {
  AccountUnitOfWork,
  emptyAccountData,
} from '../../src/infrastructure/account/unit-of-work';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

const subtasks = [
  { id: 's1', title: '检查材料', completed: false },
  { id: 's2', title: '记录结果', completed: false },
];
const draft = {
  title: '每日检查',
  notes: '',
  listId: 'system:inbox',
  tagNames: [],
  priority: 'none' as const,
  plannedAt: { kind: 'allDay' as const, date: '2026-09-22' },
  deadlineAt: { kind: 'none' as const },
  rule: { frequency: 'daily' as const, interval: 1 },
  subtasks,
};
const range = {
  rangeStart: decodeLocalDate('2026-09-22'),
  rangeEnd: decodeLocalDate('2026-09-27'),
  includeHistory: true,
};

describe('recurring subitems', () => {
  for (const backend of ['dexie', 'account'] as const) {
    it(`isolates occurrences and preserves history, scheduling and backups (${backend})`, async () => {
      const context = await createTestDatabase();
      try {
        const uow =
          backend === 'dexie'
            ? new DexieUnitOfWork(context.db)
            : new AccountUnitOfWork(emptyAccountData(decodeTimeZoneId('Asia/Shanghai')));
        await uow.repositories.settings.set('applicationTimeZone', 'Asia/Shanghai');
        const service = new RecurrenceService(uow, { now: () => '2026-09-22T01:00:00Z' });
        const query = new OccurrenceQueryService(uow);
        const series = await service.createSeries({
          ...draft,
          subtasks: subtasks.map((item) => ({ ...item, completed: true })),
        });
        expect(series.template.subtasks).toEqual(subtasks);
        const key = occurrenceKeySchema.parse(series.activeOccurrenceKey);
        const virtual = (await query.query(range)).items.find((item) => item.virtual)!;
        await expect(
          service.updateOccurrenceSubtasks(occurrenceKeySchema.parse(virtual.key), []),
        ).rejects.toMatchObject({ code: 'OCCURRENCE_NOT_ACTIVE' });
        const local = [{ ...subtasks[0]!, title: '仅本次修改', completed: true }];
        await service.updateOccurrenceSubtasks(key, local);
        await service.rescheduleOccurrence(key, {
          deadlineAt: { kind: 'allDay', date: decodeLocalDate('2026-09-23') },
        });
        expect(
          (await query.query(range)).items.find((item) => item.key === key)?.subtasks,
        ).toEqual(local);
        expect(
          (await query.query(range)).items.find((item) => item.virtual)?.subtasks,
        ).toEqual(subtasks);
        expect(
          (await new CalendarService(uow).query(range)).items.find(
            (item) => item.ownerId === key,
          )?.subtasks,
        ).toEqual(local);
        const beforeCompletion = await new RecoveryService(
          uow,
          new TodoService(uow),
          {
            now: () => '2026-09-22T01:00:00Z',
          },
          service,
        ).snapshot();
        expect(
          beforeCompletion.todayItems.find(({ task }) => task.id === key)?.task.subtasks,
        ).toEqual(local);
        const history = await service.completeOccurrence(key);
        expect(history.templateSnapshot?.subtasks).toEqual(local);
        await expect(service.updateOccurrenceSubtasks(key, [])).rejects.toMatchObject({
          code: 'OCCURRENCE_NOT_ACTIVE',
        });
        const next = (await query.query(range)).items.find(
          (item) => !item.virtual && item.state === 'pending',
        )!;
        expect(next.subtasks).toEqual(subtasks);
        await service.updateOccurrenceSubtasks(occurrenceKeySchema.parse(next.key), []);
        expect(
          (await query.query(range)).items.find((item) => item.key === next.key)
            ?.subtasks,
        ).toEqual([]);
        await service.skipOccurrence(occurrenceKeySchema.parse(next.key));
        const changed = await service.updateSeries(series.id, {
          ...draft,
          subtasks: [{ id: 'new', title: '新系列子项', completed: false }],
        });
        expect(
          (await query.history()).find((item) => item.key === key)?.subtasks,
        ).toEqual(local);
        expect(
          (await query.history()).find((item) => item.key === next.key)?.subtasks,
        ).toEqual([]);
        const recovery = new RecoveryService(
          uow,
          new TodoService(uow),
          {
            now: () => '2026-09-22T02:00:00Z',
          },
          service,
        );
        const recoverySnapshot = await recovery.snapshot();
        expect(recoverySnapshot.today).toBe('2026-09-22');
        expect(
          recoverySnapshot.todayItems.every(({ task }) => task.state === 'pending'),
        ).toBe(true);
        const review = await recovery.review({
          period: 'day',
          anchorDate: decodeLocalDate('2026-09-22'),
        });
        expect(
          review.completed.items.find(({ task }) => task.id === key)?.task.subtasks,
        ).toEqual(local);
        expect(
          review.skipped.items.find(({ task }) => task.id === next.key)?.task.subtasks,
        ).toEqual([]);
        const current = occurrenceKeySchema.parse(changed.activeOccurrenceKey);
        const pendingItems = (await query.query(range)).items.filter(
          (item) => item.state === 'pending',
        );
        expect(pendingItems[0]?.key).toBe(current);
        expect(pendingItems[0]?.virtual).toBe(false);

        await service.pauseSeries(series.id);
        await expect(service.updateOccurrenceSubtasks(current, [])).rejects.toMatchObject(
          { code: 'OCCURRENCE_NOT_ACTIVE' },
        );
        await service.resumeSeries(series.id);
        const backupService = new BackupService(uow);
        const backup = await backupService.createExport();
        await service.updateOccurrenceSubtasks(current, []);
        await backupService.restore(backupService.inspect(JSON.stringify(backup)));
        expect(
          (await query.query(range)).items.find((item) => item.key === current)?.subtasks,
        ).toEqual(changed.template.subtasks);
        expect(
          (await query.history()).find((item) => item.key === key)?.subtasks,
        ).toEqual(local);
        const { subtasks: omitted, ...legacyDraft } = draft;
        void omitted;
        expect(
          (await service.updateSeries(series.id, legacyDraft)).template.subtasks,
        ).toEqual(changed.template.subtasks);
      } finally {
        await context.cleanup();
      }
    });
  }
});
