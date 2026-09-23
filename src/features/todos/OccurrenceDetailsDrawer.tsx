import { Check, Forward, Pause, Pencil, Repeat2, Square } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { CalendarItemView, RecurrenceDraft, TodoSnapshot } from '@/application';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleFields } from './ScheduleFields';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import {
  type SchedulePoint,
  occurrenceKeySchema,
  type RecurrenceSeries,
  type Subtask,
} from '@/domain';

import { SubtaskEditor } from './SubtaskEditor';
import { cleanSubtasks } from './subtasks';
import { SeriesEditForm } from './SeriesEditForm';

interface OccurrenceDetailsDrawerProps {
  readonly item: CalendarItemView;
  readonly series?: RecurrenceSeries;
  readonly snapshot?: TodoSnapshot;
  readonly onClose: () => void;
}

export function OccurrenceDetailsDrawer({
  item,
  onClose,
  series,
  snapshot,
}: OccurrenceDetailsDrawerProps) {
  const seriesFormId = useId();
  const [subtasks, setSubtasks] = useState(item.subtasks ?? []);
  const savedSubtasks = useRef(item.subtasks ?? []);
  const savingSubtasks = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingSeries, setEditingSeries] = useState(false);
  const [pendingSeriesDraft, setPendingSeriesDraft] = useState<RecurrenceDraft>();
  const [confirmingStop, setConfirmingStop] = useState(false);
  const today = useCurrentLocalDate(snapshot?.timeZone);
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(
    item.kind === 'planned' ? item.schedule : { kind: 'none' },
  );
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(
    item.deadlineAt ?? (item.kind === 'deadline' ? item.schedule : { kind: 'none' }),
  );

  const run = async (action: 'complete' | 'skip' | 'pause' | 'stop') => {
    if (item.seriesId === undefined || item.readonly) return;
    setBusy(true);
    try {
      const recurrence = (await getApplicationServices()).recurrence;
      const occurrenceKey = occurrenceKeySchema.parse(item.ownerId);
      if (action === 'complete') await recurrence.completeOccurrence(occurrenceKey);
      else if (action === 'skip') await recurrence.skipOccurrence(occurrenceKey);
      else if (action === 'pause') await recurrence.pauseSeries(item.seriesId);
      else await recurrence.stopSeries(item.seriesId);
      toast.success(
        action === 'complete'
          ? '本次已完成'
          : action === 'skip'
            ? '本次已跳过'
            : action === 'pause'
              ? '系列已暂停'
              : '系列已停止，历史已保留',
      );
      onClose();
    } catch {
      toast.error('操作失败，原安排保持不变。');
    } finally {
      setBusy(false);
    }
  };

  const saveSubtasks = async (next: Subtask[]) => {
    if (item.readonly || savingSubtasks.current) return;
    const cleaned = cleanSubtasks(next);
    if (JSON.stringify(cleaned) === JSON.stringify(savedSubtasks.current)) return;
    savingSubtasks.current = true;
    setBusy(true);
    try {
      await (
        await getApplicationServices()
      ).recurrence.updateOccurrenceSubtasks(
        occurrenceKeySchema.parse(item.ownerId),
        cleaned,
      );
      savedSubtasks.current = cleaned;
    } catch {
      setSubtasks(savedSubtasks.current);
      toast.error('保存失败，已恢复上次保存的子任务，请重试或重新打开。');
    } finally {
      savingSubtasks.current = false;
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    setBusy(true);
    try {
      const recurrence = (await getApplicationServices()).recurrence;
      await recurrence.rescheduleOccurrence(occurrenceKeySchema.parse(item.ownerId), {
        plannedAt,
        deadlineAt,
      });
      toast.success('仅本次时间已更新');
      onClose();
    } catch {
      toast.error('改期失败，请检查计划与截止顺序。');
    } finally {
      setBusy(false);
    }
  };

  const saveSeries = async () => {
    if (series === undefined || pendingSeriesDraft === undefined) return;
    setBusy(true);
    try {
      const recurrence = (await getApplicationServices()).recurrence;
      await recurrence.updateSeries(series.id, pendingSeriesDraft);
      toast.success('整个系列已更新，历史记录已保留');
      setPendingSeriesDraft(undefined);
      onClose();
    } catch {
      toast.error('更新整个系列失败，当前实例和历史均未改变。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="size-4" />
            {item.title}
          </DialogTitle>
          <DialogDescription>
            {item.virtual
              ? '这是后续安排，暂不能完成、跳过或单次改期。调整周期请管理整个系列。'
              : item.readonly
                ? '历史只读：已处理的重复实例不能再次完成、跳过或改期。'
                : '本次完成、跳过和改期只影响这一次；暂停和停止作用于整个系列。'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3 px-6 pb-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={item.readonly ? 'outline' : 'secondary'}>
                {item.virtual ? '未来只读' : item.readonly ? '历史只读' : '本次安排'}
              </Badge>
              <Badge variant="outline">整个系列可单独管理</Badge>
            </div>
            {!editingSeries && (
              <>
                <SubtaskEditor
                  value={subtasks}
                  onChange={setSubtasks}
                  onCommit={(next) => void saveSubtasks(next)}
                  disabled={busy}
                  readOnly={item.readonly}
                />
                {!item.readonly && (
                  <div className="grid gap-2">
                    <p className="text-xs text-muted-foreground">
                      勾选后自动保存，名称编辑后离开输入框自动保存。修改仅影响本次；以后每次的子项请在「编辑整个系列」中设置。
                    </p>
                  </div>
                )}
              </>
            )}
            {editingSeries && series !== undefined && snapshot !== undefined ? (
              <SeriesEditForm
                formId={seriesFormId}
                series={series}
                snapshot={snapshot}
                disabled={busy}
                onCancel={() => setEditingSeries(false)}
                onSubmit={setPendingSeriesDraft}
              />
            ) : null}
            {!item.virtual && editingSchedule && !editingSeries ? (
              <div className="grid grid-cols-2 gap-3">
                {today ? (
                  <>
                    <ScheduleFields
                      label="仅本次计划"
                      value={plannedAt}
                      defaultDate={today}
                      onChange={setPlannedAt}
                    />
                    <ScheduleFields
                      label="仅本次截止"
                      value={deadlineAt}
                      defaultDate={today}
                      onChange={setDeadlineAt}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter className="flex-wrap sm:justify-start">
          {editingSeries && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setEditingSeries(false)}
              >
                取消编辑
              </Button>
              <Button type="submit" form={seriesFormId} disabled={busy}>
                保存整个系列
              </Button>
            </>
          )}
          {editingSchedule && !editingSeries && (
            <Button disabled={busy} onClick={() => void saveSchedule()}>
              保存仅本次改期
            </Button>
          )}
          {!item.readonly &&
          !editingSeries &&
          series !== undefined &&
          snapshot !== undefined ? (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => {
                setEditingSchedule(false);
                setEditingSeries(true);
              }}
            >
              <Pencil data-icon="inline-start" />
              编辑整个系列
            </Button>
          ) : null}
          {!item.readonly && !editingSeries ? (
            <>
              <Button disabled={busy} onClick={() => void run('complete')}>
                <Check data-icon="inline-start" />
                完成本次
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => void run('skip')}>
                <Forward data-icon="inline-start" />
                跳过本次
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => setEditingSchedule((value) => !value)}
              >
                仅本次改期
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => void run('pause')}
              >
                <Pause data-icon="inline-start" />
                暂停整个系列
              </Button>
              <Button
                disabled={busy}
                variant="destructive"
                onClick={() => setConfirmingStop(true)}
              >
                <Square data-icon="inline-start" />
                停止整个系列
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
      <AlertDialog
        open={pendingSeriesDraft !== undefined}
        onOpenChange={(open) => !open && !busy && setPendingSeriesDraft(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认编辑整个系列？</AlertDialogTitle>
            <AlertDialogDescription>
              当前待处理实例会被替换，子项按系列清单重置为未完成；已完成和已跳过的历史保留；未来按新规则重新计算。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>返回检查</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void saveSeries()}>
              确认更新整个系列
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmingStop}
        onOpenChange={(open) => !open && !busy && setConfirmingStop(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>停止整个系列？</AlertDialogTitle>
            <AlertDialogDescription>
              当前待处理实例会移除，未来不再生成；既有完成和跳过历史会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void run('stop')}
            >
              确认停止并保留历史
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
