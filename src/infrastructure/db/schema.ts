export const DATABASE_NAME = 'one-day';
export const DATABASE_VERSION = 3;

/**
 * Every indexed property is either a domain scalar or a rebuildable projection
 * defined in records.ts. Nested SchedulePoint and template values are never
 * queried as raw IndexedDB keys.
 */
export const V1_STORES = {
  singleTasks:
    'id, state, listId, plannedLocalDate, deadlineLocalDate, *tagIds, updatedAt',
  recurrenceSeries:
    'id, status, listId, activeOccurrenceKey, anchorLocalDate, *tagIds, updatedAt',
  occurrenceRecords:
    'occurrenceKey, seriesId, state, originalLocalDate, [seriesId+state]',
  lists: 'id, order, archivedValue, [archivedValue+order]',
  tags: 'id, &normalizedName',
  reminders: 'id, ownerId, target, [ownerKind+ownerId], [ownerId+target]',
  settings: 'key',
  meta: 'key',
} as const;

export const V2_STORES = {
  ...V1_STORES,
  singleTasks:
    'id, state, listId, plannedLocalDate, deadlineLocalDate, *tagIds, updatedAt',
  longTermGoals: 'id, status, updatedAt',
} as const;

/** v3 adds an optional goalId inside recurrenceSeries.template; no new index is needed. */
export const V3_STORES = V2_STORES;
