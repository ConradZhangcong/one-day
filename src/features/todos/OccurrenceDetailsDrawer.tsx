import { Check, Forward, Pause, Repeat2, Square } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { CalendarItemView } from '@/application';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  decodeSchedulePoint,
  occurrenceKeySchema,
  schedulePointLocalDate,
} from '@/domain';

interface OccurrenceDetailsDrawerProps {
  readonly item: CalendarItemView;
  readonly onClose: () => void;
}

export function OccurrenceDetailsDrawer({ item, onClose }: OccurrenceDetailsDrawerProps) {
  const [busy, setBusy] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [plannedDate, setPlannedDate] = useState(
    item.kind === 'planned' ? (schedulePointLocalDate(item.schedule) ?? '') : '',
  );
  const [deadlineDate, setDeadlineDate] = useState(
    schedulePointLocalDate(
      item.deadlineAt ?? (item.kind === 'deadline' ? item.schedule : { kind: 'none' }),
    ) ?? '',
  );

  const run = async (action: 'complete' | 'skip' | 'pause' | 'stop') => {
    if (item.seriesId === undefined || item.virtual) return;
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
      toast.error('操作失败，原实例保持不变。');
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    setBusy(true);
    try {
      const recurrence = (await getApplicationServices()).recurrence;
      await recurrence.rescheduleOccurrence(occurrenceKeySchema.parse(item.ownerId), {
        plannedAt: plannedDate
          ? decodeSchedulePoint({ kind: 'allDay', date: plannedDate })
          : { kind: 'none' },
        deadlineAt: deadlineDate
          ? decodeSchedulePoint({ kind: 'allDay', date: deadlineDate })
          : { kind: 'none' },
      });
      toast.success('仅本次时间已更新');
      onClose();
    } catch {
      toast.error('改期失败，请检查计划与截止顺序。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="size-4" />
            {item.title}
          </DialogTitle>
          <DialogDescription>
            {item.virtual
              ? '未来只读：此 occurrence 尚未物化，不能完成、跳过或仅本次改期。'
              : '当前实例操作标记为“仅本次”；暂停和停止作用于整个系列。'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6 pb-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={item.virtual ? 'outline' : 'secondary'}>
              {item.virtual ? '未来只读' : '当前实例 · 仅本次'}
            </Badge>
            <Badge variant="outline">整个系列可单独管理</Badge>
          </div>
          {!item.virtual && editingSchedule ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                仅本次计划
                <Input
                  type="date"
                  value={plannedDate}
                  onChange={(event) => setPlannedDate(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                仅本次截止
                <Input
                  type="date"
                  value={deadlineDate}
                  onChange={(event) => setDeadlineDate(event.target.value)}
                />
              </label>
              <Button
                disabled={busy}
                className="col-span-2"
                onClick={() => void saveSchedule()}
              >
                保存仅本次改期
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex-wrap sm:justify-start">
          {!item.virtual ? (
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
                onClick={() => void run('stop')}
              >
                <Square data-icon="inline-start" />
                停止整个系列
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
