import { Pause, Play, Repeat2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { TodoSnapshot } from '@/application';
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
import { EmptyState } from '@/components/ui/compat';

interface SeriesManagerProps {
  readonly open: boolean;
  readonly snapshot: TodoSnapshot;
  readonly onClose: () => void;
}

const STATUS_LABEL = {
  active: '进行中',
  paused: '已暂停',
  ended: '已自然结束',
  archived: '已停止',
} as const;

export function SeriesManager({ onClose, open, snapshot }: SeriesManagerProps) {
  const [busyId, setBusyId] = useState<string>();
  const series = [...snapshot.series].sort((left, right) => {
    const leftRank = left.status === 'paused' ? 0 : left.status === 'active' ? 1 : 2;
    const rightRank = right.status === 'paused' ? 0 : right.status === 'active' ? 1 : 2;
    return leftRank - rightRank || right.updatedAt.localeCompare(left.updatedAt);
  });

  const changeStatus = async (seriesId: string, action: 'pause' | 'resume') => {
    setBusyId(seriesId);
    try {
      const recurrence = (await getApplicationServices()).recurrence;
      if (action === 'pause') await recurrence.pauseSeries(seriesId);
      else await recurrence.resumeSeries(seriesId);
      toast.success(action === 'pause' ? '整个系列已暂停' : '整个系列已恢复');
    } catch {
      toast.error('系列状态修改失败，请重试。');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && busyId === undefined && onClose()}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="size-4" />
            管理重复系列
          </DialogTitle>
          <DialogDescription>
            暂停的系列不会出现在列表、恢复区、日历或提醒中，可随时从这里恢复原当前实例。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6 pb-2" aria-live="polite">
          {series.length === 0 ? (
            <EmptyState description="还没有重复系列" />
          ) : (
            series.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <strong className="block truncate">{item.template.title}</strong>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={item.status === 'paused' ? 'secondary' : 'outline'}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                    <Badge variant="outline">第 {item.revision} 版规则</Badge>
                  </div>
                </div>
                {item.status === 'paused' ? (
                  <Button
                    disabled={busyId !== undefined}
                    onClick={() => void changeStatus(item.id, 'resume')}
                  >
                    <Play data-icon="inline-start" />
                    恢复整个系列
                  </Button>
                ) : item.status === 'active' ? (
                  <Button
                    variant="outline"
                    disabled={busyId !== undefined}
                    onClick={() => void changeStatus(item.id, 'pause')}
                  >
                    <Pause data-icon="inline-start" />
                    暂停整个系列
                  </Button>
                ) : null}
              </article>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busyId !== undefined} onClick={onClose}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
