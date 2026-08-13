import { decodeInstant, decodeLocalDate } from '../../../src/domain';

/**
 * Keep released persistence contracts local to the fixture. Importing the
 * current record types here would make a future schema change silently turn
 * this old-browser fixture into the new shape during routine type fixes.
 */
interface V1ListRecord {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly archived: boolean;
  readonly isSystem: boolean;
  readonly archivedValue: 0 | 1;
}

interface V1SingleTaskRecord {
  readonly id: string;
  readonly title: string;
  readonly notes: string;
  readonly listId: string;
  readonly tagIds: readonly string[];
  readonly priority: 'none' | 'low' | 'medium' | 'high';
  readonly plannedAt:
    | { readonly kind: 'none' }
    | { readonly kind: 'allDay'; readonly date: string }
    | { readonly kind: 'timed'; readonly localDateTime: string };
  readonly deadlineAt:
    | { readonly kind: 'none' }
    | { readonly kind: 'allDay'; readonly date: string }
    | { readonly kind: 'timed'; readonly localDateTime: string };
  readonly state: 'pending' | 'completed' | 'skipped';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly plannedLocalDate: string | undefined;
  readonly deadlineLocalDate: string | undefined;
  readonly normalizedTitle: string;
}

const fixtureDate = decodeLocalDate('2026-08-13');
const fixtureInstant = decodeInstant('2026-08-12T16:00:00Z');

/**
 * Frozen v1 rows used as the upgrade baseline when a later Dexie version is
 * introduced. Keep this fixture in the persisted record shape, not the domain
 * shape, so migrations are tested against what existing browsers really hold.
 */
export const V1_MIGRATION_FIXTURE = {
  lists: [
    {
      id: 'system:inbox',
      name: '收件箱',
      order: 0,
      archived: false,
      isSystem: true,
      archivedValue: 0,
    },
  ] satisfies readonly V1ListRecord[],
  singleTasks: [
    {
      id: 'task:v1-fixture',
      title: '旧版本任务',
      notes: '',
      listId: 'system:inbox',
      tagIds: [],
      priority: 'none',
      plannedAt: { kind: 'allDay', date: fixtureDate },
      deadlineAt: { kind: 'none' },
      state: 'pending',
      createdAt: fixtureInstant,
      updatedAt: fixtureInstant,
      plannedLocalDate: fixtureDate,
      deadlineLocalDate: undefined,
      normalizedTitle: '旧版本任务',
    },
  ] satisfies readonly V1SingleTaskRecord[],
} as const;
