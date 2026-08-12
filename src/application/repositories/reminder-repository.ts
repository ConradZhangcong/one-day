import type { Reminder } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface ReminderRepository extends EntityRepository<Reminder, Reminder['id']> {
  findByOwner(
    ownerKind: Reminder['ownerKind'],
    ownerId: Reminder['ownerId'],
  ): Promise<Reminder[]>;
}
