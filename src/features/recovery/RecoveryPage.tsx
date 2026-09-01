import { Check, Clock3, Forward, Info, Repeat2, TriangleAlert } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import { useApplicationRevision } from '@/app/application-change';
import type { RecoverySnapshot, RecoveryTaskView } from '@/application';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/compat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  schedulePointLocalDate,
  tryParseOccurrenceKey,
  validateScheduleOrder,
  type SchedulePoint,
} from '@/domain';
import { ScheduleFields } from '@/features/todos/ScheduleFields';
import { formatSchedule } from '@/features/todos/task-view';

import { useClockTick } from './useClockTick';

type RecoveryKind = 'missed' | 'overdue';

interface RescheduleDialogProps {
  readonly item: RecoveryTaskView;
  readonly snapshot: RecoverySnapshot;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

function isDomainCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && String(error.code) === code;
}

function sameLocalDate(left: SchedulePoint, right: SchedulePoint): boolean {
  const leftDate = schedulePointLocalDate(left);
  return leftDate !== undefined && leftDate === schedulePointLocalDate(right);
}

function RescheduleDialog({ item, onCancel, onSaved, snapshot }: RescheduleDialogProps) {
  const recurring = tryParseOccurrenceKey(item.task.id) !== undefined;
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(item.task.plannedAt);
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(item.task.deadlineAt);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const validation = useMemo(
    () => validateScheduleOrder(plannedAt, deadlineAt, snapshot.timeZone),
    [deadlineAt, plannedAt, snapshot.timeZone],
  );
  const mixedSameDay =
    plannedAt.kind !== 'none' &&
    deadlineAt.kind !== 'none' &&
    plannedAt.kind !== deadlineAt.kind &&
    sameLocalDate(plannedAt, deadlineAt);

  const save = async () => {
    setSaveError(undefined);
    if (!validation.ok) {
      setSaveError('截止时间不能早于计划时间。原时间仍然保留。');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.recovery.rescheduleTask(item.task.id, { plannedAt, deadlineAt });
      toast.success('已按新时间重新安排');
      onSaved();
    } catch (error) {
      setSaveError(
        isDomainCode(error, 'DEADLINE_BEFORE_PLAN')
          ? '截止时间不能早于计划时间。原时间仍然保留。'
          : '重新安排失败，草稿和原任务时间都已保留，请重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onCancel()}>
      <DialogContent showCloseButton={!saving} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {recurring ? '仅本次改期' : '重新安排'}“{item.task.title}”
          </DialogTitle>
          <DialogDescription>
            {recurring
              ? '只修改当前活跃实例，不改变整个系列的后续规则相位。'
              : '只有保存后才会修改原任务时间。'}
          </DialogDescription>
        </DialogHeader>
        <div className="reschedule-form">
          <Alert>
            <Info />
            <AlertTitle>原时间不会被静默移到今天</AlertTitle>
            <AlertDescription>当前安排：{formatSchedule(item.task)}。</AlertDescription>
          </Alert>
          <ScheduleFields
            label="计划"
            value={plannedAt}
            defaultDate={snapshot.today}
            timeZone={snapshot.timeZone}
            onChange={(value) => {
              setSaveError(undefined);
              setPlannedAt(value);
            }}
          />
          <ScheduleFields
            label="截止"
            value={deadlineAt}
            defaultDate={snapshot.today}
            timeZone={snapshot.timeZone}
            onChange={(value) => {
              setSaveError(undefined);
              setDeadlineAt(value);
            }}
          />
          {mixedSameDay ? (
            <Alert>
              <Info />
              <AlertTitle>同一天的全天与具体时间可以同时保存</AlertTitle>
              <AlertDescription>
                {plannedAt.kind === 'allDay'
                  ? '全天计划表示当天准备执行，具体截止时间表示当天最晚完成时刻。'
                  : '具体计划时间表示当天开始执行，全天截止表示当天结束前完成。'}
              </AlertDescription>
            </Alert>
          ) : null}
          {!validation.ok || saveError !== undefined ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{saveError ?? '截止时间不能早于计划时间。'}</AlertTitle>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onCancel}>
            取消
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? '正在保存…' : '保存新时间'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecoveryTaskCard({
  busy,
  item,
  kind,
  onAction,
}: {
  readonly item: RecoveryTaskView;
  readonly kind: RecoveryKind;
  readonly busy: boolean;
  readonly onAction: (
    item: RecoveryTaskView,
    action: 'complete' | 'skip' | 'reschedule',
  ) => void;
}) {
  const recurring = tryParseOccurrenceKey(item.task.id) !== undefined;
  return (
    <article className={`recovery-card recovery-${kind}`}>
      <div className="recovery-card-copy">
        <span className="task-state">
          {kind === 'overdue' ? '⚠ 已逾期' : '◷ 计划已错过'}
        </span>
        <h3>{item.task.title}</h3>
        <p>{formatSchedule(item.task)}</p>
        <div className="recovery-flags flex flex-wrap gap-2">
          {kind === 'overdue' ? (
            <Badge variant="outline">
              <TriangleAlert /> 保留原截止时间
            </Badge>
          ) : null}
          {kind === 'missed' ? (
            <Badge variant="outline">
              <Clock3 /> 保留原计划时间
            </Badge>
          ) : null}
          {kind === 'overdue' && item.status.missedPlan ? (
            <Badge variant="secondary">计划也已错过</Badge>
          ) : null}
          {recurring ? (
            <Badge variant="secondary">
              <Repeat2 /> 当前重复实例 · 仅本次
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="recovery-actions flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy}
          aria-label={`${recurring ? '完成本次' : '完成'}${item.task.title}`}
          onClick={() => onAction(item, 'complete')}
        >
          <Check data-icon="inline-start" /> {recurring ? '完成本次' : '完成'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          aria-label={`${recurring ? '跳过本次' : '跳过'}${item.task.title}`}
          onClick={() => onAction(item, 'skip')}
        >
          <Forward data-icon="inline-start" /> {recurring ? '跳过本次' : '跳过'}
        </Button>
        <Button
          disabled={busy}
          aria-label={`${recurring ? '仅本次改期' : '重新安排'}${item.task.title}`}
          onClick={() => onAction(item, 'reschedule')}
        >
          {recurring ? '仅本次改期' : '重新安排'}
        </Button>
      </div>
    </article>
  );
}

export function RecoveryPage() {
  const applicationRevision = useApplicationRevision();
  const [searchParams] = useSearchParams();
  const kind: RecoveryKind =
    searchParams.get('kind') === 'overdue' ? 'overdue' : 'missed';
  const [busyTaskId, setBusyTaskId] = useState<string>();
  const [rescheduling, setRescheduling] = useState<RecoveryTaskView>();
  const clockTick = useClockTick();
  const snapshot = useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.recovery.snapshot();
  }, [applicationRevision, clockTick]);

  const runAction = async (
    item: RecoveryTaskView,
    action: 'complete' | 'skip' | 'reschedule',
  ) => {
    if (action === 'reschedule') {
      setRescheduling(item);
      return;
    }
    setBusyTaskId(item.task.id);
    try {
      const services = await getApplicationServices();
      if (action === 'complete') await services.recovery.completeTask(item.task.id);
      else await services.recovery.skipTask(item.task.id);
      toast.success(action === 'complete' ? '任务已完成' : '任务已跳过');
    } catch {
      toast.error('操作失败，任务仍保留在原位置，请重试。');
    } finally {
      setBusyTaskId(undefined);
    }
  };

  const items =
    snapshot === undefined
      ? []
      : kind === 'overdue'
        ? snapshot.overdueItems
        : snapshot.missedPlanItems;

  return (
    <section className="feature-page recovery-page">
      <header className="feature-header">
        <div>
          <p className="page-eyebrow">恢复节奏</p>
          <h1>恢复</h1>
          <p className="text-muted-foreground">
            时间会保留原样；由你决定完成、跳过或重新安排。
          </p>
        </div>
      </header>
      <nav className="recovery-tabs" aria-label="恢复分组">
        <Link
          className={kind === 'missed' ? 'active' : undefined}
          aria-current={kind === 'missed' ? 'page' : undefined}
          to="/recovery?kind=missed"
        >
          错过计划{snapshot === undefined ? '' : ` ${snapshot.missedPlanItems.length}`}
        </Link>
        <Link
          className={kind === 'overdue' ? 'active' : undefined}
          aria-current={kind === 'overdue' ? 'page' : undefined}
          to="/recovery?kind=overdue"
        >
          已逾期{snapshot === undefined ? '' : ` ${snapshot.overdueItems.length}`}
        </Link>
      </nav>
      {snapshot === undefined ? (
        <LoadingState label="正在加载恢复任务…" />
      ) : items.length === 0 ? (
        <EmptyState
          description={kind === 'overdue' ? '没有仍逾期的任务' : '没有错过计划的任务'}
        />
      ) : (
        <div className="recovery-list" aria-live="polite">
          {items.map((item) => (
            <RecoveryTaskCard
              key={item.task.id}
              item={item}
              kind={kind}
              busy={busyTaskId === item.task.id}
              onAction={(task, action) => void runAction(task, action)}
            />
          ))}
        </div>
      )}
      {rescheduling !== undefined && snapshot !== undefined ? (
        <RescheduleDialog
          key={rescheduling.task.id}
          item={rescheduling}
          snapshot={snapshot}
          onCancel={() => setRescheduling(undefined)}
          onSaved={() => setRescheduling(undefined)}
        />
      ) : null}
    </section>
  );
}
