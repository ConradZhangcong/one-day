import type { TaskList } from '../../domain';

export interface DeleteListResult {
  movedSingleTaskCount: number;
  movedRecurrenceSeriesCount: number;
}

export interface ListRepository {
  get(id: TaskList['id']): Promise<TaskList | undefined>;
  getAll(): Promise<TaskList[]>;
  save(list: TaskList): Promise<void>;
  saveMany(lists: readonly TaskList[]): Promise<void>;
  listInDisplayOrder(options?: { includeArchived?: boolean }): Promise<TaskList[]>;
  deleteAndMoveContentsToInbox(listId: TaskList['id']): Promise<DeleteListResult>;
}
