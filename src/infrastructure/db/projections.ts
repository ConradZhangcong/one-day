import {
  normalizeIndexedText,
  schedulePointLocalDate,
  type OccurrenceRecord,
  type RecurrenceSeries,
  type SingleTask,
  type Tag,
  type TaskList,
} from '../../domain';

export { normalizeIndexedText, schedulePointLocalDate } from '../../domain';

import type {
  ListRecord,
  OccurrenceRecordRecord,
  RecurrenceSeriesRecord,
  SingleTaskRecord,
  TagRecord,
} from './records';

export function toSingleTaskRecord(task: SingleTask): SingleTaskRecord {
  return {
    ...task,
    plannedLocalDate: schedulePointLocalDate(task.plannedAt),
    deadlineLocalDate: schedulePointLocalDate(task.deadlineAt),
    normalizedTitle: normalizeIndexedText(task.title),
  };
}

export function fromSingleTaskRecord(record: SingleTaskRecord): SingleTask {
  const expectedPlanned = schedulePointLocalDate(record.plannedAt);
  const expectedDeadline = schedulePointLocalDate(record.deadlineAt);
  if (
    record.plannedLocalDate !== expectedPlanned ||
    record.deadlineLocalDate !== expectedDeadline ||
    record.normalizedTitle !== normalizeIndexedText(record.title)
  ) {
    throw new TypeError('Single-task index projection is inconsistent.');
  }
  const { deadlineLocalDate, normalizedTitle, plannedLocalDate, ...task } = record;
  void deadlineLocalDate;
  void normalizedTitle;
  void plannedLocalDate;

  return task;
}

export function toRecurrenceSeriesRecord(
  series: RecurrenceSeries,
): RecurrenceSeriesRecord {
  const anchorPoint =
    series.anchor === 'planned' ? series.template.plannedAt : series.template.deadlineAt;
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
  const anchorPoint =
    record.anchor === 'planned' ? record.template.plannedAt : record.template.deadlineAt;
  if (
    record.listId !== record.template.listId ||
    record.anchorLocalDate !== schedulePointLocalDate(anchorPoint) ||
    record.tagIds.length !== record.template.tagIds.length ||
    record.tagIds.some((id, index) => id !== record.template.tagIds[index])
  ) {
    throw new TypeError('Recurrence-series index projection is inconsistent.');
  }
  const { anchorLocalDate, listId, tagIds, ...series } = record;
  void anchorLocalDate;
  void listId;
  void tagIds;

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
  if (record.originalLocalDate !== schedulePointLocalDate(record.originalAnchor)) {
    throw new TypeError('Occurrence-record index projection is inconsistent.');
  }
  const { originalLocalDate, ...occurrence } = record;
  void originalLocalDate;
  return occurrence;
}

export function toListRecord(list: TaskList): ListRecord {
  return { ...list, archivedValue: list.archived ? 1 : 0 };
}

export function fromListRecord(record: ListRecord): TaskList {
  if (record.archivedValue !== (record.archived ? 1 : 0)) {
    throw new TypeError('List index projection is inconsistent.');
  }
  const { archivedValue, ...list } = record;
  void archivedValue;
  return list;
}

export function toTagRecord(tag: Tag): TagRecord {
  return { ...tag, normalizedName: normalizeIndexedText(tag.name) };
}

export function fromTagRecord(record: TagRecord): Tag {
  if (record.normalizedName !== normalizeIndexedText(record.name)) {
    throw new TypeError('Tag index projection is inconsistent.');
  }
  const { normalizedName, ...tag } = record;
  void normalizedName;
  return tag;
}
