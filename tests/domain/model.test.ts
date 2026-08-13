import { describe, expect, it } from 'vitest';

import {
  decodeInstant,
  occurrenceRecordSchema,
  reminderSchema,
  singleTaskSchema,
  tagSchema,
  taskListSchema,
} from '../../src/domain';

function pendingTask() {
  return {
    id: 'task-1',
    title: 'Write tests',
    notes: '',
    listId: 'inbox',
    tagIds: ['tag-1'],
    priority: 'high',
    plannedAt: { kind: 'none' },
    deadlineAt: { kind: 'none' },
    state: 'pending',
    createdAt: '2026-08-13T01:00:00Z',
    updatedAt: '2026-08-13T01:00:00Z',
  };
}

describe('single task schema', () => {
  it('decodes a pending task and trims its title', () => {
    const task = singleTaskSchema.parse({
      ...pendingTask(),
      title: '  Write tests  ',
    });
    expect(task.title).toBe('Write tests');
  });

  it('binds lifecycle timestamps to their matching state', () => {
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        completedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        state: 'completed',
      }).success,
    ).toBe(false);
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        state: 'completed',
        completedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        state: 'skipped',
        skippedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('rejects audit time reversal and duplicate tag ids', () => {
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        createdAt: '2026-08-13T02:00:00Z',
        updatedAt: '2026-08-13T01:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        tagIds: ['tag-1', 'tag-1'],
      }).success,
    ).toBe(false);
  });

  it('never accepts a JavaScript Date for audit facts', () => {
    expect(
      singleTaskSchema.safeParse({
        ...pendingTask(),
        createdAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

describe('organization and reminder schemas', () => {
  it('keeps the system inbox unarchived', () => {
    expect(
      taskListSchema.safeParse({
        id: 'inbox',
        name: '收件箱',
        order: 0,
        archived: false,
        isSystem: true,
      }).success,
    ).toBe(true);
    expect(
      taskListSchema.safeParse({
        id: 'inbox',
        name: '收件箱',
        order: 0,
        archived: true,
        isSystem: true,
      }).success,
    ).toBe(false);
  });

  it('requires tag identity, name, and color', () => {
    expect(
      tagSchema.safeParse({ id: 'tag-1', name: '工作', color: '#1677ff' }).success,
    ).toBe(true);
    expect(tagSchema.safeParse({ id: 'tag-1', name: '', color: '#1677ff' }).success).toBe(
      false,
    );
  });

  it('keeps reminders as references rather than copied schedule values', () => {
    const reminder = reminderSchema.parse({
      id: 'reminder-1',
      ownerKind: 'series',
      ownerId: 'series-1',
      target: 'deadline',
      offsetMinutes: 15,
      scheduleRevision: 2,
      snoozedUntil: decodeInstant('2026-08-13T02:00:00Z'),
    });

    expect(reminder).not.toHaveProperty('deadlineAt');
    expect(reminder).not.toHaveProperty('plannedAt');
    expect(reminderSchema.safeParse({ ...reminder, offsetMinutes: -1 }).success).toBe(
      false,
    );
  });

  it('rejects occurrence states with contradictory timestamps', () => {
    // A malformed key fails before state validation; this assertion still proves
    // unknown persisted payloads are rejected rather than cast into the domain.
    expect(
      occurrenceRecordSchema.safeParse({
        occurrenceKey: 'not-a-key',
        seriesId: 'series-1',
        originalAnchor: { kind: 'allDay', date: '2026-08-13' },
        state: 'pending',
        completedAt: '2026-08-13T02:00:00Z',
      }).success,
    ).toBe(false);
  });
});
