import type { OccurrenceRecord } from '../../domain';

import type { EntityRepository } from './base-repository';

export interface OccurrenceRecordRepository extends EntityRepository<
  OccurrenceRecord,
  OccurrenceRecord['occurrenceKey']
> {
  findBySeriesId(seriesId: OccurrenceRecord['seriesId']): Promise<OccurrenceRecord[]>;
  findBySeriesAndState(
    seriesId: OccurrenceRecord['seriesId'],
    state: OccurrenceRecord['state'],
  ): Promise<OccurrenceRecord[]>;
}
