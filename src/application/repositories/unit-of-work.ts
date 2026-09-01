import type { ListRepository } from './list-repository';
import type { KeyValueRepository } from './key-value-repository';
import type { OccurrenceRecordRepository } from './occurrence-record-repository';
import type { RecurrenceSeriesRepository } from './recurrence-series-repository';
import type { ReminderRepository } from './reminder-repository';
import type { SingleTaskRepository } from './single-task-repository';
import type { TagRepository } from './tag-repository';
import type { LongTermGoalRepository } from './long-term-goal-repository';

export interface OneDayRepositories {
  singleTasks: SingleTaskRepository;
  recurrenceSeries: RecurrenceSeriesRepository;
  occurrenceRecords: OccurrenceRecordRepository;
  lists: ListRepository;
  tags: TagRepository;
  reminders: ReminderRepository;
  settings: KeyValueRepository;
  meta: KeyValueRepository;
  longTermGoals: LongTermGoalRepository;
}

export interface UnitOfWork {
  readonly repositories: OneDayRepositories;

  write<TResult>(
    operation: (repositories: OneDayRepositories) => Promise<TResult> | TResult,
  ): Promise<TResult>;
}
