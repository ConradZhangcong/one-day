import { z } from 'zod';

import {
  compareInstants,
  compareLocalDates,
  instantToLocalDate,
  localDateTimeToInstant,
  type Instant,
  type SchedulePoint,
  type TimeZoneId,
} from '../schedule/time';

export const taskStateSchema = z.enum(['pending', 'completed', 'skipped']);
export type TaskState = z.infer<typeof taskStateSchema>;

export const recoveryGroupSchema = z.enum(['none', 'missedPlan', 'overdue']);
export type RecoveryGroup = z.infer<typeof recoveryGroupSchema>;

export interface SchedulableTaskState {
  readonly state: TaskState;
  readonly plannedAt: SchedulePoint;
  readonly deadlineAt: SchedulePoint;
}

export interface DerivedTaskStatus {
  readonly missedPlan: boolean;
  readonly overdue: boolean;
  /** Overdue wins so a task never appears in both main recovery lists. */
  readonly recoveryGroup: RecoveryGroup;
}

export function isSchedulePointPast(
  point: SchedulePoint,
  now: Instant,
  timeZone: TimeZoneId,
): boolean {
  switch (point.kind) {
    case 'none':
      return false;
    case 'allDay':
      return compareLocalDates(instantToLocalDate(now, timeZone), point.date) > 0;
    case 'timed':
      return (
        compareInstants(
          localDateTimeToInstant(point.localDateTime, timeZone),
          now,
        ) < 0
      );
  }
}

export function deriveTaskStatus(
  task: SchedulableTaskState,
  now: Instant,
  timeZone: TimeZoneId,
): DerivedTaskStatus {
  if (task.state !== 'pending') {
    return { missedPlan: false, overdue: false, recoveryGroup: 'none' };
  }

  const missedPlan = isSchedulePointPast(task.plannedAt, now, timeZone);
  const overdue = isSchedulePointPast(task.deadlineAt, now, timeZone);

  return {
    missedPlan,
    overdue,
    recoveryGroup: overdue ? 'overdue' : missedPlan ? 'missedPlan' : 'none',
  };
}

export const deriveScheduleStatus = deriveTaskStatus;
