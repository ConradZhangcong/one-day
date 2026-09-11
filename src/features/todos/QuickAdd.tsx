import { Plus, Repeat2 } from 'lucide-react';
import { Temporal } from 'temporal-polyfill';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { getApplicationServices } from '@/app/application';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/compat';
import {
  decodeSchedulePoint,
  decodeLocalDate,
  SYSTEM_INBOX_ID,
  type SchedulePoint,
  type LongTermGoal,
  type FixedRecurrenceRule,
} from '@/domain';
import { ScheduleFields } from './ScheduleFields';
import { RecurrenceFields } from './RecurrenceFields';

export function QuickAdd({
  defaultListId,
  today,
  goals,
  defaultGoalId = '',
  defaultPlannedDate,
  onCreated,
  initiallyExpanded = false,
}: {
  readonly onCreated?: () => void;
  readonly initiallyExpanded?: boolean;
  readonly defaultGoalId?: string;
  readonly defaultPlannedDate?: string;
  readonly defaultListId: string;
  readonly today: string;
  readonly goals: readonly LongTermGoal[];
}) {
  const navigate = useNavigate();
  const inputId = useId();
  const [expanded, setExpanded] = useState(initiallyExpanded || Boolean(defaultGoalId));
  const [title, setTitle] = useState('');
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(
    defaultPlannedDate
      ? decodeSchedulePoint({ kind: 'allDay', date: defaultPlannedDate })
      : { kind: 'none' },
  );
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>({ kind: 'none' });
  const [saving, setSaving] = useState(false);
  const [goalId, setGoalId] = useState(defaultGoalId);
  const [recurring, setRecurring] = useState(false);
  const [rule, setRule] = useState<FixedRecurrenceRule>({
    frequency: 'daily',
    interval: 1,
    end: { kind: 'never' },
  });
  const recurrenceAnchor =
    plannedAt.kind !== 'none'
      ? plannedAt
      : deadlineAt.kind !== 'none'
        ? deadlineAt
        : undefined;

  const create = async () => {
    if (!title.trim()) {
      toast.warning('请输入任务标题');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      const draft = {
        title,
        notes: '',
        listId: defaultListId,
        tagNames: [],
        priority: 'none' as const,
        plannedAt,
        deadlineAt,
        ...(goalId ? { goalId } : {}),
      };
      if (recurring) await services.recurrence.createSeries({ ...draft, rule });
      else await services.todos.createTask(draft);
      onCreated?.();
      setTitle('');
      setPlannedAt(
        defaultPlannedDate
          ? decodeSchedulePoint({ kind: 'allDay', date: defaultPlannedDate })
          : { kind: 'none' },
      );
      setDeadlineAt({ kind: 'none' });
      setGoalId(defaultGoalId);
      setRecurring(false);
      toast.success(
        recurring
          ? '重复事项已创建'
          : plannedAt.kind === 'none' && deadlineAt.kind === 'none'
            ? '已添加，可在收件箱或所属清单查看'
            : '任务已加入',
        {
          action: {
            label: '查看任务',
            onClick: () =>
              void navigate(
                defaultListId === SYSTEM_INBOX_ID
                  ? '/inbox'
                  : `/lists/${encodeURIComponent(defaultListId)}`,
              ),
          },
        },
      );
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      toast.error(
        code === 'DEADLINE_BEFORE_PLAN'
          ? '截止时间不能早于计划时间。'
          : '创建失败，输入内容仍为你保留。',
      );
    } finally {
      setSaving(false);
    }
  };

  const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString();
  return (
    <form
      className="quick-add"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <div className="relative">
        <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          id={initiallyExpanded ? inputId : 'quick-add-title'}
          aria-label="任务标题"
          className="h-11 pl-9"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="添加一件待办，按 Enter 保存"
        />
      </div>
      <div className="flex gap-2">
        {!initiallyExpanded ? (
          <Button
            type="button"
            variant="outline"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            日期与更多
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={saving || (recurring && recurrenceAnchor === undefined)}
        >
          {saving ? '正在添加…' : recurring ? '创建重复事项' : '添加'}
        </Button>
      </div>
      <div hidden={!expanded} className="quick-add-details">
        {recurring && plannedAt.kind === 'none' && deadlineAt.kind === 'none' ? (
          <p className="text-sm text-destructive">请先选择首次发生日期（计划或截止）。</p>
        ) : null}
        {recurring && recurrenceAnchor !== undefined ? (
          <RecurrenceFields anchor={recurrenceAnchor} rule={rule} onChange={setRule} />
        ) : null}
        <div className="quick-schedule">
          <div className="quick-plan-group">
            <ScheduleFields
              label="快速计划"
              value={plannedAt}
              defaultDate={decodeLocalDate(today)}
              onChange={setPlannedAt}
            />
            <div className="quick-date-shortcuts">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPlannedAt(
                    decodeSchedulePoint(
                      plannedAt.kind === 'timed'
                        ? {
                            kind: 'timed',
                            localDateTime: `${today}T${plannedAt.localDateTime.slice(11)}`,
                          }
                        : { kind: 'allDay', date: today },
                    ),
                  )
                }
              >
                今天
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPlannedAt(
                    decodeSchedulePoint(
                      plannedAt.kind === 'timed'
                        ? {
                            kind: 'timed',
                            localDateTime: `${tomorrow}T${plannedAt.localDateTime.slice(11)}`,
                          }
                        : { kind: 'allDay', date: tomorrow },
                    ),
                  )
                }
              >
                明天
              </Button>
            </div>
          </div>
          <ScheduleFields
            label="快速截止"
            value={deadlineAt}
            defaultDate={decodeLocalDate(today)}
            onChange={setDeadlineAt}
          />
          <SimpleSelect
            allowClear
            ariaLabel="关联长期目标"
            placeholder="关联目标"
            value={goalId || undefined}
            options={goals
              .filter((goal) => goal.status !== 'archived')
              .map((goal) => ({ value: goal.id, label: goal.title }))}
            onChange={(value) => setGoalId(typeof value === 'string' ? value : '')}
          />
          <Button
            type="button"
            variant={recurring ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setRecurring((value) => !value)}
          >
            <Repeat2 data-icon="inline-start" /> {recurring ? '收起重复' : '重复'}
          </Button>
        </div>
      </div>
    </form>
  );
}
