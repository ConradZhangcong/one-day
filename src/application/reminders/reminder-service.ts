import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import {
  DomainError,
  DomainErrorCode,
  decodeInstant,
  decodeLocalTime,
  reminderSchema,
  reviseReminderSchedule,
  type Instant,
  type LocalTime,
  type Reminder,
  type ReminderOwnerKind,
  type ReminderTarget,
} from '../../domain';
import type { UnitOfWork } from '../repositories';

export const ALL_DAY_REMINDER_TIME_KEY = 'allDayReminderTime';
export const DEFAULT_ALL_DAY_REMINDER_TIME = decodeLocalTime('09:00');

const reminderDraftSchema = z
  .object({
    ownerKind: z.enum(['task', 'series']),
    ownerId: z.string().min(1),
    target: z.enum(['planned', 'deadline']),
    offsetMinutes: z.number().int().nonnegative(),
  })
  .strict();

export interface ReminderDraft {
  readonly ownerKind: ReminderOwnerKind;
  readonly ownerId: string;
  readonly target: ReminderTarget;
  readonly offsetMinutes: number;
}

export class ReminderService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  list(ownerKind: ReminderOwnerKind, ownerId: string): Promise<Reminder[]> {
    return this.unitOfWork.repositories.reminders.findByOwner(ownerKind, ownerId);
  }

  create(input: ReminderDraft): Promise<Reminder> {
    const draft = reminderDraftSchema.parse(input);
    return this.unitOfWork.write(async (repositories) => {
      const schedule =
        draft.ownerKind === 'task'
          ? await repositories.singleTasks.get(draft.ownerId)
          : (await repositories.recurrenceSeries.get(draft.ownerId))?.template;
      assertReminderTarget(schedule, draft);
      const reminder = reminderSchema.parse({
        id: `reminder:${this.createId()}`,
        ...draft,
        scheduleRevision: 0,
        snoozeRevision: 0,
      });
      await repositories.reminders.save(reminder);
      return reminder;
    });
  }

  update(
    reminderId: string,
    patch: Pick<ReminderDraft, 'target' | 'offsetMinutes'>,
  ): Promise<Reminder> {
    return this.unitOfWork.write(async (repositories) => {
      const existing = await repositories.reminders.get(reminderId);
      if (existing === undefined) {
        throw new DomainError(
          DomainErrorCode.REMINDER_NOT_FOUND,
          'Reminder does not exist.',
        );
      }
      const draft = reminderDraftSchema.parse({
        ownerKind: existing.ownerKind,
        ownerId: existing.ownerId,
        ...patch,
      });
      const schedule =
        draft.ownerKind === 'task'
          ? await repositories.singleTasks.get(draft.ownerId)
          : (await repositories.recurrenceSeries.get(draft.ownerId))?.template;
      assertReminderTarget(schedule, draft);
      const changed =
        draft.target !== existing.target ||
        draft.offsetMinutes !== existing.offsetMinutes;
      const updated = changed
        ? reviseReminderSchedule(reminderSchema.parse({ ...existing, ...draft }))
        : existing;
      if (changed) await repositories.reminders.save(updated);
      return updated;
    });
  }

  remove(reminderId: string): Promise<void> {
    return this.unitOfWork.write(({ reminders }) => reminders.remove(reminderId));
  }

  snooze(reminderId: string, until: Instant): Promise<Reminder> {
    const snoozedUntil = decodeInstant(until);
    return this.unitOfWork.write(async ({ reminders }) => {
      const existing = await reminders.get(reminderId);
      if (existing === undefined) {
        throw new DomainError(
          DomainErrorCode.REMINDER_NOT_FOUND,
          'Reminder does not exist.',
        );
      }
      const updated = reminderSchema.parse({
        ...existing,
        snoozedUntil,
        snoozeRevision: existing.snoozeRevision + 1,
      });
      await reminders.save(updated);
      return updated;
    });
  }

  snoozeForMinutes(
    reminderId: string,
    minutes: number,
    now?: Instant,
  ): Promise<Reminder> {
    const until = decodeInstant(
      Temporal.Instant.from(now ?? Temporal.Now.instant().toString())
        .add({ minutes: z.number().int().positive().parse(minutes) })
        .toString(),
    );
    return this.snooze(reminderId, until);
  }

  async getAllDayDefaultTime(): Promise<LocalTime> {
    const stored = await this.unitOfWork.repositories.settings.get(
      ALL_DAY_REMINDER_TIME_KEY,
    );
    return stored === undefined ? DEFAULT_ALL_DAY_REMINDER_TIME : decodeLocalTime(stored);
  }

  setAllDayDefaultTime(value: LocalTime): Promise<LocalTime> {
    const decoded = decodeLocalTime(value);
    return this.unitOfWork.write(async ({ settings }) => {
      await settings.set(ALL_DAY_REMINDER_TIME_KEY, decoded);
      return decoded;
    });
  }
}

function assertReminderTarget(
  schedule:
    | {
        readonly plannedAt: ReminderSchedulePoint;
        readonly deadlineAt: ReminderSchedulePoint;
      }
    | undefined,
  draft: ReminderDraft,
): void {
  if (schedule === undefined) {
    throw new DomainError(
      DomainErrorCode.REMINDER_OWNER_NOT_FOUND,
      'Reminder owner missing.',
    );
  }
  const targetPoint =
    draft.target === 'planned' ? schedule.plannedAt : schedule.deadlineAt;
  if (targetPoint.kind === 'none') {
    throw new DomainError(
      DomainErrorCode.REMINDER_TARGET_MISSING,
      'Referenced schedule target missing.',
    );
  }
}

type ReminderSchedulePoint =
  | { readonly kind: 'none' }
  | { readonly kind: 'allDay'; readonly date: string }
  | { readonly kind: 'timed'; readonly localDateTime: string };
