import type { SingleTask } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface SingleTaskRepository
  extends EntityRepository<SingleTask, SingleTask['id']> {
  findByListId(listId: SingleTask['listId']): Promise<SingleTask[]>;
  findByState(state: SingleTask['state']): Promise<SingleTask[]>;
}
