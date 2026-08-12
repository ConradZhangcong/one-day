import {
  schedulePointLocalDate,
  type OccurrenceRecord,
  type RecurrenceSeries,
  type SingleTask,
  type Tag,
  type TaskList,
} from '../../domain';

export { schedulePointLocalDate } from '../../domain';

import type {
  ListRecord,
  OccurrenceRecordRecord,
  RecurrenceSeriesRecord,
  SingleTaskRecord,
  TagRecord,
} from './records';

export function normalizeIndexedText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
}

export function toSingleTaskRecord(task: SingleTask): SingleTaskRecord {
  return {
    ...task,
    plannedLocalDate: schedulePointLocalDate(task.plannedAt),
    deadlineLocalDate: schedulePointLocalDate(task.deadlineAt),
    normalizedTitle: normalizeIndexedText(task.title),
  };
}

export function fromSingleTaskRecord(record: SingleTaskRecord): SingleTask {
  const {
    deadlineLocalDate: _deadlineLocalDate,
    normalizedTitle: _normalizedTitle,
    plannedLocalDate: _plannedLocalDate,
    ...task
  } = record;

  return task;
}

export function toRecurrenceSeriesRecord(
  series: RecurrenceSeries,
): RecurrenceSeriesRecord {
  const anchorPoint =
    series.anchor === 'planned'
      ? series.template.plannedAt
      : series.template.deadlineAt;
  const anchorLocalDate = schedulePointLocalDate(anchorPoint);

  if (anchorLocalDate === undefined) {
    throw new TypeError('A recurrence series anchor cannot be none.');
  }

  return {
    ...series,
    anchorLocalDate,
    listId: series.template.listId,
    tagIds: series.template.tagIds,
  };
}

export function fromRecurrenceSeriesRecord(
  record: RecurrenceSeriesRecord,
): RecurrenceSeries {
  const {
    anchorLocalDate: _anchorLocalDate,
    listId: _listId,
    tagIds: _tagIds,
    ...series
  } = record;

  return series;
}

export function toOccurrenceRecordRecord(
  occurrence: OccurrenceRecord,
): OccurrenceRecordRecord {
  const originalLocalDate = schedulePointLocalDate(occurrence.originalAnchor);

  if (originalLocalDate === undefined) {
    throw new TypeError('An occurrence original anchor cannot be none.');
  }

  return { ...occurrence, originalLocalDate };
}

export function fromOccurrenceRecordRecord(
  record: OccurrenceRecordRecord,
): OccurrenceRecord {
  const { originalLocalDate: _originalLocalDate, ...occurrence } = record;
  return occurrence;
}

export function toListRecord(list: TaskList): ListRecord {
  return { ...list, archivedValue: list.archived ? 1 : 0 };
}

export function fromListRecord(record: ListRecord): TaskList {
  const { archivedValue: _archivedValue, ...list } = record;
  return list;
}

export function toTagRecord(tag: Tag): TagRecord {
  return { ...tag, normalizedName: normalizeIndexedText(tag.name) };
}

export function fromTagRecord(record: TagRecord): Tag {
  const { normalizedName: _normalizedName, ...tag } = record;
  return tag;
}
