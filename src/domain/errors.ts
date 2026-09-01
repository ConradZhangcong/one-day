export const DomainErrorCode = {
  INVALID_LOCAL_DATE: 'INVALID_LOCAL_DATE',
  INVALID_LOCAL_DATE_TIME: 'INVALID_LOCAL_DATE_TIME',
  INVALID_INSTANT: 'INVALID_INSTANT',
  INVALID_TIME_ZONE: 'INVALID_TIME_ZONE',
  INVALID_SCHEDULE_POINT: 'INVALID_SCHEDULE_POINT',
  DEADLINE_BEFORE_PLAN: 'DEADLINE_BEFORE_PLAN',
  INVALID_TASK: 'INVALID_TASK',
  INVALID_LIST: 'INVALID_LIST',
  INVALID_TAG: 'INVALID_TAG',
  INVALID_REMINDER: 'INVALID_REMINDER',
  INVALID_RECURRENCE: 'INVALID_RECURRENCE',
  RECURRENCE_ANCHOR_MISSING: 'RECURRENCE_ANCHOR_MISSING',
  INVALID_OCCURRENCE: 'INVALID_OCCURRENCE',
  INVALID_OCCURRENCE_KEY: 'INVALID_OCCURRENCE_KEY',
  LIST_NOT_FOUND: 'LIST_NOT_FOUND',
  SYSTEM_LIST_IMMUTABLE: 'SYSTEM_LIST_IMMUTABLE',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_HANDLED: 'TASK_ALREADY_HANDLED',
  INVALID_REVIEW_RANGE: 'INVALID_REVIEW_RANGE',
  REMINDER_NOT_FOUND: 'REMINDER_NOT_FOUND',
  REMINDER_TARGET_MISSING: 'REMINDER_TARGET_MISSING',
  REMINDER_OWNER_NOT_FOUND: 'REMINDER_OWNER_NOT_FOUND',
  ARCHIVED_LIST: 'ARCHIVED_LIST',
  GOAL_NOT_FOUND: 'GOAL_NOT_FOUND',
  ARCHIVED_GOAL: 'ARCHIVED_GOAL',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

/** Upper-case alias for consumers that prefer constants over enum-like names. */
export const DOMAIN_ERROR_CODES = DomainErrorCode;

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
