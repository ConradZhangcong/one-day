import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import {
  assertValidSchedulePair,
  compareScheduledPoints,
  createOccurrenceKey,
  decodeFixedRecurrenceRule,
  decodeInstant,
  decodeTaskDraft,
  decodeTimeZoneId,
  DomainError,
  DomainErrorCode,
  fixedRecurrenceRuleSchema,
  instantSchema,
  localDateSchema,
  localDateTimeSchema,
  nextOccurrenceAfter,
  occurrenceRecordSchema,
  projectOccurrenceRange,
  projectOccurrenceSchedule,
  recurrenceSeriesSchema,
  reviseReminderSchedule,
  schedulePointSchema,
  tagSchema,
  type Instant,
  type LongTermGoal,
  type OccurrenceKey,
  type OccurrenceRecord,
  type ProjectedOccurrenceIdentity,
  type RecurrenceSeries,
  type SchedulePoint,
  type ScheduledPoint,
  type Tag,
  type TaskList,
  type TaskDraft,
  type TimeZoneId,
} from '../../domain';
import type { OneDayRepositories, UnitOfWork } from '../repositories';
import { APPLICATION_TIME_ZONE_KEY } from '../settings';

const recurrenceDraftSchema = z
  .object({
    title: z.string().trim().min(1),
    notes: z.string(),
    listId: z.string().min(1),
    tagNames: z.array(z.string().trim().min(1)),
    priority: z.enum(['none', 'low', 'medium', 'high']),
    plannedAt: schedulePointSchema,
    deadlineAt: schedulePointSchema,
    goalId: z.string().min(1).optional(),
    rule: fixedRecurrenceRuleSchema,
  })
  .strict();

export type RecurrenceDraft = z.infer<typeof recurrenceDraftSchema>;

export interface RecurrencePreviewItem extends ProjectedOccurrenceIdentity {
  readonly plannedAt: SchedulePoint;
  readonly deadlineAt: SchedulePoint;
}

export interface RecurrenceServiceDependencies {
  readonly createId?: () => string;
  readonly now?: () => string;
  readonly detectTimeZone?: () => string;
  readonly onScheduleChanged?: () => void;
}

export interface RescheduleOccurrencePatch {
  readonly plannedAt?: SchedulePoint;
  readonly deadlineAt?: SchedulePoint;
}

function defaultId(): string {
  return crypto.randomUUID();
}

function defaultNow(): string {
  return Temporal.Now.instant().toString();
}

function defaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function anchorOf(draft: Pick<RecurrenceDraft, 'plannedAt' | 'deadlineAt'>): {
  readonly kind: 'planned' | 'deadline';
  readonly point: ScheduledPoint;
} {
  if (draft.plannedAt.kind !== 'none') return { kind: 'planned', point: draft.plannedAt };
  if (draft.deadlineAt.kind !== 'none') {
    return { kind: 'deadline', point: draft.deadlineAt };
  }
  throw new DomainError(
    DomainErrorCode.RECURRENCE_ANCHOR_MISSING,
    'A recurring item requires a first planned or deadline time.',
  );
}

function nowThreshold(
  now: Instant,
  timeZone: TimeZoneId,
  kind: ScheduledPoint['kind'],
): ScheduledPoint {
  const zoned = Temporal.Instant.from(now).toZonedDateTimeISO(timeZone);
  if (kind === 'allDay') {
    return {
      kind: 'allDay',
      date: localDateSchema.parse(zoned.toPlainDate().toString()),
    };
  }
  return {
    kind: 'timed',
    localDateTime: localDateTimeSchema.parse(
      zoned.toPlainDateTime().toString({ smallestUnit: 'minute' }),
    ),
  };
}

function normalizedName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
}

const TAG_COLORS = ['green', 'blue', 'gold', 'purple', 'cyan', 'magenta'] as const;

export class RecurrenceService {
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly detectTimeZone: () => string;
  private readonly onScheduleChanged: () => void;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    dependencies: RecurrenceServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? defaultId;
    this.now = dependencies.now ?? defaultNow;
    this.detectTimeZone = dependencies.detectTimeZone ?? defaultTimeZone;
    this.onScheduleChanged = dependencies.onScheduleChanged ?? (() => undefined);
  }

  preview(input: unknown, limit = 3): RecurrencePreviewItem[] {
    const draft = recurrenceDraftSchema.parse(input);
    const anchor = anchorOf(draft);
    const synthetic = recurrenceSeriesSchema.parse({
      id: 'preview',
      template: { ...this.taskDetails(draft), tagIds: [] },
      anchor: anchor.kind,
      rule: draft.rule,
      status: 'active',
      activeOccurrenceKey: createOccurrenceKey('preview', 1, anchor.point),
      revision: 1,
      createdAt: instantSchema.parse('2000-01-01T00:00:00Z'),
      updatedAt: instantSchema.parse('2000-01-01T00:00:00Z'),
    });
    return projectOccurrenceRange({
      seriesId: synthetic.id,
      revision: 1,
      anchor: anchor.point,
      rule: draft.rule,
      limit,
    }).map((identity) => ({
      ...identity,
      ...projectOccurrenceSchedule(synthetic, identity.originalAnchor),
    }));
  }

  async createSeries(input: unknown): Promise<RecurrenceSeries> {
    const draft = recurrenceDraftSchema.parse(input);
    const created = await this.unitOfWork.write(async (repositories) => {
      const storedZone = await repositories.settings.get(APPLICATION_TIME_ZONE_KEY);
      const list = await repositories.lists.get(draft.listId);
      const tags = await repositories.tags.getAll();
      const goal =
        draft.goalId === undefined
          ? undefined
          : await repositories.longTermGoals.get(draft.goalId);
      const context = this.prepareLoadedDraft(draft, storedZone, list, tags, goal);
      if (context.createdTags.length > 0) {
        await repositories.tags.saveMany(context.createdTags);
      }
      const anchor = anchorOf(draft);
      const first = projectOccurrenceRange({
        seriesId: context.seriesId,
        revision: 1,
        anchor: anchor.point,
        rule: draft.rule,
        limit: 1,
      })[0];
      if (first === undefined) {
        throw new DomainError(
          DomainErrorCode.INVALID_RECURRENCE,
          'The recurrence rule has no occurrence at its anchor.',
        );
      }
      const series = recurrenceSeriesSchema.parse({
        id: context.seriesId,
        template: { ...this.taskDetails(draft), tagIds: context.tagIds },
        anchor: anchor.kind,
        rule: draft.rule,
        status: 'active',
        activeOccurrenceKey: first.occurrenceKey,
        revision: 1,
        createdAt: context.instant,
        updatedAt: context.instant,
      });
      const occurrence = occurrenceRecordSchema.parse({
        occurrenceKey: first.occurrenceKey,
        seriesId: series.id,
        originalAnchor: first.originalAnchor,
        state: 'pending',
      });
      await repositories.recurrenceSeries.save(series);
      await repositories.occurrenceRecords.save(occurrence);
      return series;
    });
    this.onScheduleChanged();
    return created;
  }

  completeOccurrence(key: OccurrenceKey): Promise<OccurrenceRecord> {
    return this.handleOccurrence(key, 'completed');
  }

  skipOccurrence(key: OccurrenceKey): Promise<OccurrenceRecord> {
    return this.handleOccurrence(key, 'skipped');
  }

  async rescheduleOccurrence(
    key: OccurrenceKey,
    patch: RescheduleOccurrencePatch,
  ): Promise<OccurrenceRecord> {
    if (patch.plannedAt === undefined && patch.deadlineAt === undefined) {
      throw new DomainError(
        DomainErrorCode.INVALID_SCHEDULE_POINT,
        'At least one occurrence schedule field must change.',
      );
    }
    const updated = await this.unitOfWork.write(async (repositories) => {
      const occurrence = await repositories.occurrenceRecords.get(key);
      const series =
        occurrence === undefined
          ? undefined
          : await repositories.recurrenceSeries.get(occurrence.seriesId);
      const storedZone = await repositories.settings.get(APPLICATION_TIME_ZONE_KEY);
      const active = this.assertActive(series, occurrence, key);
      const zone = decodeTimeZoneId(storedZone ?? this.detectTimeZone());
      const projected = projectOccurrenceSchedule(
        active.series,
        active.occurrence.originalAnchor,
        {
          ...(active.occurrence.overridePlannedAt !== undefined
            ? { plannedAt: active.occurrence.overridePlannedAt }
            : {}),
          ...(active.occurrence.overrideDeadlineAt !== undefined
            ? { deadlineAt: active.occurrence.overrideDeadlineAt }
            : {}),
        },
      );
      const plannedAt =
        patch.plannedAt === undefined
          ? projected.plannedAt
          : schedulePointSchema.parse(patch.plannedAt);
      const deadlineAt =
        patch.deadlineAt === undefined
          ? projected.deadlineAt
          : schedulePointSchema.parse(patch.deadlineAt);
      assertValidSchedulePair({ plannedAt, deadlineAt }, zone);
      const result = occurrenceRecordSchema.parse({
        ...active.occurrence,
        overridePlannedAt: plannedAt,
        overrideDeadlineAt: deadlineAt,
      });
      await repositories.occurrenceRecords.save(result);
      await this.reviseSeriesReminders(repositories, active.series, result);
      return result;
    });
    this.onScheduleChanged();
    return updated;
  }

  pauseSeries(seriesId: string): Promise<RecurrenceSeries> {
    return this.changeStatus(seriesId, 'active', 'paused');
  }

  resumeSeries(seriesId: string): Promise<RecurrenceSeries> {
    return this.changeStatus(seriesId, 'paused', 'active');
  }

  async stopSeries(seriesId: string): Promise<RecurrenceSeries> {
    const result = await this.unitOfWork.write(async (repositories) => {
      const series = this.requireSeriesValue(
        await repositories.recurrenceSeries.get(seriesId),
        seriesId,
      );
      if (series.status !== 'active' && series.status !== 'paused') {
        this.invalidState(series);
      }
      if (series.activeOccurrenceKey !== undefined) {
        await repositories.occurrenceRecords.remove(series.activeOccurrenceKey);
      }
      const instant = decodeInstant(this.now());
      const updated = recurrenceSeriesSchema.parse({
        ...series,
        status: 'archived',
        activeOccurrenceKey: undefined,
        updatedAt: instant,
      });
      await repositories.recurrenceSeries.save(updated);
      return updated;
    });
    this.onScheduleChanged();
    return result;
  }

  async updateSeries(seriesId: string, input: unknown): Promise<RecurrenceSeries> {
    const draft = recurrenceDraftSchema.parse(input);
    const result = await this.unitOfWork.write(async (repositories) => {
      const existing = this.requireSeriesValue(
        await repositories.recurrenceSeries.get(seriesId),
        seriesId,
      );
      if (existing.status !== 'active' && existing.status !== 'paused') {
        this.invalidState(existing);
      }
      const storedZone = await repositories.settings.get(APPLICATION_TIME_ZONE_KEY);
      const list = await repositories.lists.get(draft.listId);
      const tags = await repositories.tags.getAll();
      const goal =
        draft.goalId === undefined
          ? undefined
          : await repositories.longTermGoals.get(draft.goalId);
      const context = this.prepareLoadedDraft(
        draft,
        storedZone,
        list,
        tags,
        goal,
        seriesId,
      );
      if (context.createdTags.length > 0) {
        await repositories.tags.saveMany(context.createdTags);
      }
      const anchor = anchorOf(draft);
      const revision = existing.revision + 1;
      const provisional = recurrenceSeriesSchema.parse({
        ...existing,
        template: { ...this.taskDetails(draft), tagIds: context.tagIds },
        anchor: anchor.kind,
        rule: draft.rule,
        status: 'active',
        activeOccurrenceKey: createOccurrenceKey(seriesId, revision, anchor.point),
        revision,
        updatedAt: context.instant,
      });
      const threshold = nowThreshold(
        context.instant,
        context.timeZone,
        anchor.point.kind,
      );
      const projected = projectOccurrenceRange({
        seriesId,
        revision,
        anchor: anchor.point,
        rule: draft.rule,
        rangeStart: threshold,
        limit: 2,
      }).find((item) => compareScheduledPoints(item.originalAnchor, threshold) > 0);
      if (existing.activeOccurrenceKey !== undefined) {
        await repositories.occurrenceRecords.remove(existing.activeOccurrenceKey);
      }
      if (projected === undefined) {
        const ended = recurrenceSeriesSchema.parse({
          ...provisional,
          status: 'ended',
          activeOccurrenceKey: undefined,
        });
        await repositories.recurrenceSeries.save(ended);
        return ended;
      }
      const updated = recurrenceSeriesSchema.parse({
        ...provisional,
        status: existing.status,
        activeOccurrenceKey: projected.occurrenceKey,
      });
      await repositories.recurrenceSeries.save(updated);
      await repositories.occurrenceRecords.save(
        occurrenceRecordSchema.parse({
          occurrenceKey: projected.occurrenceKey,
          seriesId,
          originalAnchor: projected.originalAnchor,
          state: 'pending',
        }),
      );
      await this.reviseSeriesReminders(repositories, updated);
      return updated;
    });
    this.onScheduleChanged();
    return result;
  }

  private async handleOccurrence(
    key: OccurrenceKey,
    state: 'completed' | 'skipped',
  ): Promise<OccurrenceRecord> {
    const handled = await this.unitOfWork.write(async (repositories) => {
      const occurrence = await repositories.occurrenceRecords.get(key);
      const series =
        occurrence === undefined
          ? undefined
          : await repositories.recurrenceSeries.get(occurrence.seriesId);
      const storedZone = await repositories.settings.get(APPLICATION_TIME_ZONE_KEY);
      const active = this.assertActive(series, occurrence, key);
      const instant = decodeInstant(this.now());
      const snapshot = { ...active.series.template, capturedAt: instant };
      const history = occurrenceRecordSchema.parse(
        state === 'completed'
          ? {
              ...active.occurrence,
              state,
              completedAt: instant,
              templateSnapshot: snapshot,
            }
          : {
              ...active.occurrence,
              state,
              skippedAt: instant,
              templateSnapshot: snapshot,
            },
      );
      await repositories.occurrenceRecords.save(history);
      const zone = decodeTimeZoneId(storedZone ?? this.detectTimeZone());
      const currentThreshold = nowThreshold(
        instant,
        zone,
        active.occurrence.originalAnchor.kind,
      );
      const after =
        compareScheduledPoints(active.occurrence.originalAnchor, currentThreshold) > 0
          ? active.occurrence.originalAnchor
          : currentThreshold;
      const next = nextOccurrenceAfter({ series: active.series, after });
      const updated = recurrenceSeriesSchema.parse(
        next === undefined
          ? {
              ...active.series,
              status: 'ended',
              activeOccurrenceKey: undefined,
              updatedAt: instant,
            }
          : {
              ...active.series,
              activeOccurrenceKey: next.occurrenceKey,
              updatedAt: instant,
            },
      );
      await repositories.recurrenceSeries.save(updated);
      if (next !== undefined) {
        await repositories.occurrenceRecords.save(
          occurrenceRecordSchema.parse({
            occurrenceKey: next.occurrenceKey,
            seriesId: active.series.id,
            originalAnchor: next.originalAnchor,
            state: 'pending',
          }),
        );
      }
      return history;
    });
    this.onScheduleChanged();
    return handled;
  }

  private async changeStatus(
    seriesId: string,
    expected: RecurrenceSeries['status'],
    status: RecurrenceSeries['status'],
  ): Promise<RecurrenceSeries> {
    const result = await this.unitOfWork.write(async (repositories) => {
      const series = this.requireSeriesValue(
        await repositories.recurrenceSeries.get(seriesId),
        seriesId,
      );
      if (series.status !== expected) this.invalidState(series);
      const updated = recurrenceSeriesSchema.parse({
        ...series,
        status,
        updatedAt: decodeInstant(this.now()),
      });
      await repositories.recurrenceSeries.save(updated);
      return updated;
    });
    this.onScheduleChanged();
    return result;
  }

  private assertActive(
    series: RecurrenceSeries | undefined,
    occurrence: OccurrenceRecord | undefined,
    key: OccurrenceKey,
  ) {
    if (occurrence?.state !== 'pending') {
      throw new DomainError(
        DomainErrorCode.OCCURRENCE_NOT_ACTIVE,
        'Only the current pending occurrence can be changed.',
      );
    }
    if (series === undefined) {
      throw new DomainError(
        DomainErrorCode.RECURRENCE_SERIES_NOT_FOUND,
        'The recurrence series does not exist.',
        { occurrenceKey: key },
      );
    }
    if (series.status !== 'active' || series.activeOccurrenceKey !== key) {
      throw new DomainError(
        DomainErrorCode.OCCURRENCE_NOT_ACTIVE,
        'Only the active occurrence can be changed.',
      );
    }
    return { series, occurrence };
  }

  private requireSeriesValue(series: RecurrenceSeries | undefined, id: string) {
    if (series === undefined) {
      throw new DomainError(
        DomainErrorCode.RECURRENCE_SERIES_NOT_FOUND,
        'The recurrence series does not exist.',
        { seriesId: id },
      );
    }
    return series;
  }

  private invalidState(series: RecurrenceSeries): never {
    throw new DomainError(
      DomainErrorCode.RECURRENCE_SERIES_STATE_INVALID,
      'The recurrence series is not in a state that permits this action.',
      { seriesId: series.id, status: series.status },
    );
  }

  private prepareLoadedDraft(
    draft: RecurrenceDraft,
    storedZone: unknown,
    list: TaskList | undefined,
    tags: readonly Tag[],
    goal: LongTermGoal | undefined,
    existingSeriesId?: string,
  ) {
    decodeTaskDraft(this.taskDraft(draft));
    decodeFixedRecurrenceRule(draft.rule);
    if (list === undefined) {
      throw new DomainError(DomainErrorCode.LIST_NOT_FOUND, 'The list does not exist.');
    }
    if (list.archived) {
      throw new DomainError(DomainErrorCode.ARCHIVED_LIST, 'The list is archived.');
    }
    if (draft.goalId !== undefined && goal === undefined) {
      throw new DomainError(DomainErrorCode.GOAL_NOT_FOUND, 'The goal does not exist.');
    }
    if (goal?.status === 'archived') {
      throw new DomainError(DomainErrorCode.ARCHIVED_GOAL, 'The goal is archived.');
    }
    const timeZone = decodeTimeZoneId(storedZone ?? this.detectTimeZone());
    assertValidSchedulePair(draft, timeZone);
    const prepared = this.prepareTags(tags, draft.tagNames);
    return {
      seriesId: existingSeriesId ?? `series:${this.createId()}`,
      tagIds: prepared.ids,
      instant: decodeInstant(this.now()),
      timeZone,
      createdTags: prepared.created,
    };
  }

  private taskDraft(draft: RecurrenceDraft): TaskDraft {
    const { rule: _rule, ...task } = draft;
    void _rule;
    return task;
  }

  private taskDetails(draft: RecurrenceDraft) {
    const { rule: _rule, tagNames: _tagNames, ...details } = draft;
    void _rule;
    void _tagNames;
    return details;
  }

  private prepareTags(existing: readonly Tag[], names: readonly string[]) {
    const unique = [
      ...new Map(names.map((name) => [normalizedName(name), name.trim()])).values(),
    ].filter(Boolean);
    const ids: string[] = [];
    const created: Tag[] = [];
    for (const [index, name] of unique.entries()) {
      const found = existing.find(
        (tag) => normalizedName(tag.name) === normalizedName(name),
      );
      if (found !== undefined) ids.push(found.id);
      else {
        const tag = tagSchema.parse({
          id: `tag:${this.createId()}`,
          name,
          color: TAG_COLORS[index % TAG_COLORS.length],
        });
        ids.push(tag.id);
        created.push(tag);
      }
    }
    return { ids, created };
  }

  private async reviseSeriesReminders(
    repositories: OneDayRepositories,
    series: RecurrenceSeries,
    occurrence?: OccurrenceRecord,
  ): Promise<void> {
    const reminders = await repositories.reminders.findByOwner('series', series.id);
    const schedule =
      occurrence === undefined
        ? series.template
        : projectOccurrenceSchedule(series, occurrence.originalAnchor, {
            ...(occurrence.overridePlannedAt !== undefined
              ? { plannedAt: occurrence.overridePlannedAt }
              : {}),
            ...(occurrence.overrideDeadlineAt !== undefined
              ? { deadlineAt: occurrence.overrideDeadlineAt }
              : {}),
          });
    for (const reminder of reminders) {
      const target =
        reminder.target === 'planned' ? schedule.plannedAt : schedule.deadlineAt;
      if (target.kind === 'none') await repositories.reminders.remove(reminder.id);
      else await repositories.reminders.save(reviseReminderSchedule(reminder));
    }
  }
}
