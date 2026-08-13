import { Temporal } from 'temporal-polyfill';

import {
  decodeInstant,
  decodeLocalTime,
  decodeTimeZoneId,
  deriveReminderTrigger,
  projectActiveOccurrenceSchedule,
  type Reminder,
  type ResolvedReminderTrigger,
} from '../../domain';
import type { UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';
import {
  ALL_DAY_REMINDER_TIME_KEY,
  DEFAULT_ALL_DAY_REMINDER_TIME,
} from './reminder-service';

const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 30_000;
const MAX_TIMER_MS = 2_147_000_000;

export interface ReminderDelivery {
  readonly reminder: Reminder;
  readonly trigger: ResolvedReminderTrigger;
  readonly title: string;
}

export interface ReminderRuntimeDependencies {
  readonly now?: () => string;
  readonly isVisible?: () => boolean;
  readonly deliver: (delivery: ReminderDelivery) => void | Promise<void>;
  readonly setTimer?: (callback: () => void, delay: number) => number;
  readonly clearTimer?: (timer: number) => void;
}

interface Candidate extends ReminderDelivery {
  readonly triggerEpochMilliseconds: number;
}

export class ReminderRuntime {
  private readonly now: () => string;
  private readonly isVisible: () => boolean;
  private readonly setTimer: (callback: () => void, delay: number) => number;
  private readonly clearTimer: (timer: number) => void;
  private timer: number | undefined;
  private heartbeat: number | undefined;
  private running = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly dependencies: ReminderRuntimeDependencies,
  ) {
    this.now = dependencies.now ?? (() => Temporal.Now.instant().toString());
    this.isVisible =
      dependencies.isVisible ??
      (() => typeof document === 'undefined' || document.visibilityState === 'visible');
    this.setTimer =
      dependencies.setTimer ?? ((callback, delay) => window.setTimeout(callback, delay));
    this.clearTimer = dependencies.clearTimer ?? ((timer) => window.clearTimeout(timer));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWake);
      window.addEventListener('pageshow', this.handleWake);
      document.addEventListener('visibilitychange', this.handleVisible);
      this.heartbeat = window.setInterval(this.handleWake, HEARTBEAT_MS);
    }
    void this.reconcile();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelTimer();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWake);
      window.removeEventListener('pageshow', this.handleWake);
      document.removeEventListener('visibilitychange', this.handleVisible);
      if (this.heartbeat !== undefined) window.clearInterval(this.heartbeat);
    }
    this.heartbeat = undefined;
  }

  reconcile(): Promise<void> {
    this.queue = this.queue.catch(() => undefined).then(() => this.reconcileOnce());
    return this.queue;
  }

  applicationTimeZoneChanged(): Promise<void> {
    return this.reconcile();
  }

  private readonly handleWake = () => {
    void this.reconcile();
  };
  private readonly handleVisible = () => {
    if (this.isVisible()) void this.reconcile();
  };

  private async reconcileOnce(): Promise<void> {
    this.cancelTimer();
    const nowMs = Temporal.Instant.from(decodeInstant(this.now())).epochMilliseconds;
    const candidates = await this.loadCandidates();
    let nextFuture: Candidate | undefined;
    for (const candidate of candidates) {
      const lateness = nowMs - candidate.triggerEpochMilliseconds;
      if (lateness < 0) {
        nextFuture ??= candidate;
        continue;
      }
      if (!this.isVisible() || lateness > RECOVERY_WINDOW_MS) continue;
      const claimed = await this.unitOfWork.write(({ reminders }) =>
        reminders.claimDelivery(candidate.reminder.id, candidate.trigger.deliveryKey),
      );
      if (claimed) await this.dependencies.deliver(candidate);
    }
    if (this.running && nextFuture !== undefined) {
      const delay = Math.max(
        0,
        Math.min(nextFuture.triggerEpochMilliseconds - nowMs, MAX_TIMER_MS),
      );
      this.timer = this.setTimer(() => void this.reconcile(), delay);
    }
  }

  private async loadCandidates(): Promise<Candidate[]> {
    const repositories = this.unitOfWork.repositories;
    const [reminders, tasks, series, occurrences, storedZone, storedAllDayTime] =
      await Promise.all([
        repositories.reminders.getAll(),
        repositories.singleTasks.getAll(),
        repositories.recurrenceSeries.getAll(),
        repositories.occurrenceRecords.getAll(),
        repositories.settings.get(APPLICATION_TIME_ZONE_KEY),
        repositories.settings.get(ALL_DAY_REMINDER_TIME_KEY),
      ]);
    const timeZone = decodeTimeZoneId(
      storedZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const allDayTime =
      storedAllDayTime === undefined
        ? DEFAULT_ALL_DAY_REMINDER_TIME
        : decodeLocalTime(storedAllDayTime);
    const candidates: Candidate[] = [];
    for (const reminder of reminders) {
      let schedule;
      let title: string | undefined;
      if (reminder.ownerKind === 'task') {
        const task = tasks.find((item) => item.id === reminder.ownerId);
        if (task?.state !== 'pending') continue;
        schedule = task;
        title = task.title;
      } else {
        const owner = series.find((item) => item.id === reminder.ownerId);
        const occurrence = occurrences.find(
          (item) => item.occurrenceKey === owner?.activeOccurrenceKey,
        );
        if (owner === undefined || occurrence === undefined) continue;
        schedule = projectActiveOccurrenceSchedule(owner, occurrence);
        title = owner.template.title;
      }
      if (schedule === undefined || title === undefined) continue;
      const trigger = deriveReminderTrigger(reminder, schedule, allDayTime, timeZone);
      if (trigger === undefined) continue;
      candidates.push({
        reminder,
        trigger,
        title,
        triggerEpochMilliseconds: Temporal.Instant.from(trigger.triggerInstant)
          .epochMilliseconds,
      });
    }
    return candidates.sort(
      (left, right) => left.triggerEpochMilliseconds - right.triggerEpochMilliseconds,
    );
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = undefined;
  }
}
