import type { RecurrenceSeries } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface RecurrenceSeriesRepository extends EntityRepository<
  RecurrenceSeries,
  RecurrenceSeries['id']
> {
  findByListId(
    listId: RecurrenceSeries['template']['listId'],
  ): Promise<RecurrenceSeries[]>;
  findByStatus(status: RecurrenceSeries['status']): Promise<RecurrenceSeries[]>;
}
