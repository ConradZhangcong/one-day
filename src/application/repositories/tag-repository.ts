import type { Tag } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface TagRepository extends EntityRepository<Tag, Tag['id']> {
  findByName(name: string): Promise<Tag | undefined>;
}
