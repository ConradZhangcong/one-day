import type { LongTermGoal } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface LongTermGoalRepository extends EntityRepository<
  LongTermGoal,
  LongTermGoal['id']
> {
  findByStatus(status: LongTermGoal['status']): Promise<LongTermGoal[]>;
}
