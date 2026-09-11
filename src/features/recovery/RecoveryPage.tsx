import { PageActions } from '@/app/PageActions';
import { Check, Clock3, Forward, Info, Repeat2, TriangleAlert } from 'lucide-react';
import { Temporal } from 'temporal-polyfill';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
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
  decodeSchedulePoint,
  schedulePointLocalDate,
  tryParseOccurrenceKey,
  validateScheduleOrder,
  type SchedulePoint,
} from '@/domain';
import { ScheduleFields } from '@/features/todos/ScheduleFields';
import { formatSchedule } from '@/features/todos/task-view';

import { useClockTick } from './useClockTick';

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
              ? '只调整这一次的时间，后续仍按原周期安排。'
              : '只有保存后才会修改原任务时间。'}
          </DialogDescription>
        </DialogHeader>
        <div className="reschedule-form">
          <Alert>
            <Info />
            <AlertTitle>原时间不会被静默移到今天</AlertTitle>
            <AlertDescription>当前安排：{formatSchedule(item.task)}。</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            {[0, 1].map((offset) => (
              <Button
                key={offset}
                variant="outline"
                disabled={saving}
                onClick={() => {
                  const date = Temporal.PlainDate.from(snapshot.today)
                    .add({ days: offset })
                    .toString();
                  setPlannedAt(
                    decodeSchedulePoint(
                      plannedAt.kind === 'timed'
                        ? {
                            kind: 'timed',
                            localDateTime: `${date}T${plannedAt.localDateTime.slice(11)}`,
                          }
                        : { kind: 'allDay', date },
                    ),
                  );
                  setSaveError(undefined);
                }}
              >
                {offset === 0 ? '计划今天' : '计划明天'}
              </Button>
            ))}
          </div>
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
  onAction,
}: {
  readonly item: RecoveryTaskView;
  readonly busy: boolean;
  readonly onAction: (
    item: RecoveryTaskView,
    action: 'complete' | 'skip' | 'reschedule',
  ) => void;
}) {
  const recurring = tryParseOccurrenceKey(item.task.id) !== undefined;
  const kind = item.status.overdue ? 'overdue' : 'missed';
  return (
    <article className={`recovery-card recovery-${kind}`}>
      <div className="recovery-card-copy">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={kind === 'overdue' ? 'destructive' : 'secondary'}>
            {kind === 'overdue' ? <TriangleAlert /> : <Clock3 />}
            {kind === 'overdue' ? '已逾期' : '错过计划'}
          </Badge>
          {kind === 'overdue' && item.status.missedPlan ? (
            <span className="text-xs text-muted-foreground">计划也已错过</span>
          ) : null}
        </div>
        <h3>{item.task.title}</h3>
        <p>{formatSchedule(item.task)}</p>
        <div className="recovery-flags flex flex-wrap gap-2">
          {recurring ? (
            <Badge variant="secondary">
              <Repeat2 /> 重复事项 · 仅本次
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

  // The service groups are mutually exclusive; overdue items take priority.
  // Legacy ?kind= links intentionally show the same combined list.
  const items = snapshot ? [...snapshot.overdueItems, ...snapshot.missedPlanItems] : [];

  return (
    <section className="feature-page recovery-page">
      <header className="feature-header">
        <div>
          <h1>待恢复</h1>
        </div>
        <PageActions />
      </header>
      {snapshot !== undefined ? (
        <div className="recovery-summary" role="status">
          <strong>共 {items.length} 项待恢复</strong>
          <span>已逾期 {snapshot.overdueItems.length} 项</span>
          <span>错过计划 {snapshot.missedPlanItems.length} 项</span>
        </div>
      ) : null}
      {snapshot === undefined ? (
        <LoadingState label="正在加载恢复任务…" />
      ) : items.length === 0 ? (
        <EmptyState description="没有需要恢复的任务" />
      ) : (
        <div className="recovery-list" aria-live="polite">
          {items.map((item) => (
            <RecoveryTaskCard
              key={item.task.id}
              item={item}
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
