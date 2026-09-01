import { Temporal } from 'temporal-polyfill';
import { useMemo, useState } from 'react';

import type { RecurrenceDraft, TodoSnapshot } from '@/application';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  decodeLocalDate,
  prioritySchema,
  projectOccurrenceRange,
  schedulePointLocalDate,
  validateScheduleOrder,
  type Priority,
  type RecurrenceSeries,
  type SchedulePoint,
} from '@/domain';

import { RecurrenceFields } from './RecurrenceFields';
import { ScheduleFields } from './ScheduleFields';

interface SeriesEditFormProps {
  readonly series: RecurrenceSeries;
  readonly snapshot: TodoSnapshot;
  readonly disabled?: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (draft: RecurrenceDraft) => void;
}

function parsePriority(value: string): Priority {
  const parsed = prioritySchema.safeParse(value);
  return parsed.success ? parsed.data : 'none';
}

export function SeriesEditForm({
  disabled,
  onCancel,
  onSubmit,
  series,
  snapshot,
}: SeriesEditFormProps) {
  const [title, setTitle] = useState(series.template.title);
  const [notes, setNotes] = useState(series.template.notes);
  const [listId, setListId] = useState(series.template.listId);
  const [tagNames, setTagNames] = useState(
    series.template.tagIds.flatMap((id) => {
      const tag = snapshot.tags.find((item) => item.id === id);
      return tag === undefined ? [] : [tag.name];
    }),
  );
  const [goalId, setGoalId] = useState(series.template.goalId ?? '');
  const [priority, setPriority] = useState(series.template.priority);
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(series.template.plannedAt);
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(series.template.deadlineAt);
  const [rule, setRule] = useState(series.rule);
  const anchor = plannedAt.kind !== 'none' ? plannedAt : deadlineAt;
  const defaultDate =
    schedulePointLocalDate(anchor) ??
    decodeLocalDate(
      Temporal.Now.zonedDateTimeISO(snapshot.timeZone).toPlainDate().toString(),
    );
  const valid = useMemo(() => {
    if (!title.trim() || anchor.kind === 'none') return false;
    if (!validateScheduleOrder(plannedAt, deadlineAt, snapshot.timeZone).ok) {
      return false;
    }
    try {
      return (
        projectOccurrenceRange({
          seriesId: series.id,
          revision: series.revision + 1,
          anchor,
          rule,
          limit: 1,
        }).length > 0
      );
    } catch {
      return false;
    }
  }, [
    anchor,
    deadlineAt,
    plannedAt,
    rule,
    series.id,
    series.revision,
    snapshot.timeZone,
    title,
  ]);

  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      notes,
      listId,
      tagNames,
      ...(goalId ? { goalId } : {}),
      priority,
      plannedAt,
      deadlineAt,
      rule,
    });
  };

  return (
    <div className="grid gap-4" aria-label="编辑整个系列">
      <Alert>
        <AlertTitle>作用范围：整个系列</AlertTitle>
        <AlertDescription>
          保存会替换当前待处理实例、保留已完成或已跳过的历史，并按新规则重算未来。
        </AlertDescription>
      </Alert>
      <div className="grid gap-1">
        <Label htmlFor="series-title">系列标题</Label>
        <Input
          id="series-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="series-notes">系列备注</Label>
        <Textarea
          id="series-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="series-list">清单</Label>
          <NativeSelect
            id="series-list"
            value={listId}
            onChange={(event) => setListId(event.target.value)}
          >
            {snapshot.lists
              .filter((item) => !item.archived || item.id === listId)
              .map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="series-priority">优先级</Label>
          <NativeSelect
            id="series-priority"
            value={priority}
            onChange={(event) => setPriority(parsePriority(event.target.value))}
          >
            <NativeSelectOption value="none">无</NativeSelectOption>
            <NativeSelectOption value="low">低</NativeSelectOption>
            <NativeSelectOption value="medium">中</NativeSelectOption>
            <NativeSelectOption value="high">高</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="series-tags">标签</Label>
          <Input
            id="series-tags"
            value={tagNames.join('，')}
            placeholder="用逗号分隔多个标签"
            onChange={(event) =>
              setTagNames(
                event.target.value
                  .split(/[,，]/)
                  .map((value) => value.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="series-goal">长期目标</Label>
          <NativeSelect
            id="series-goal"
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
          >
            <NativeSelectOption value="">不关联目标</NativeSelectOption>
            {snapshot.goals
              .filter(
                (goal) =>
                  goal.status !== 'archived' || goal.id === series.template.goalId,
              )
              .map((goal) => (
                <NativeSelectOption key={goal.id} value={goal.id}>
                  {goal.title}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
      </div>
      <ScheduleFields
        label="整个系列计划"
        value={plannedAt}
        defaultDate={defaultDate}
        timeZone={snapshot.timeZone}
        onChange={setPlannedAt}
      />
      <ScheduleFields
        label="整个系列截止"
        value={deadlineAt}
        defaultDate={defaultDate}
        timeZone={snapshot.timeZone}
        onChange={setDeadlineAt}
      />
      {anchor.kind !== 'none' ? (
        <RecurrenceFields anchor={anchor} rule={rule} onChange={setRule} />
      ) : (
        <p className="text-sm text-destructive">整个系列必须保留计划或截止锚点。</p>
      )}
      {!valid ? (
        <p role="alert" className="text-sm text-destructive">
          请检查标题、时间顺序、首次发生日和重复规则。
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>
          取消编辑
        </Button>
        <Button type="button" disabled={(disabled ?? false) || !valid} onClick={submit}>
          保存整个系列
        </Button>
      </div>
    </div>
  );
}
