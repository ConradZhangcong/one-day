import { useLiveQuery } from 'dexie-react-hooks';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/compat';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { Reminder, ReminderTarget, SingleTask } from '@/domain';

export function TaskReminderEditor({ task }: { readonly task: SingleTask }) {
  const reminders = useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.reminders.list('task', task.id);
  }, [task.id]);
  const reminder = reminders?.[0];
  if (reminders === undefined) return <Spinner aria-label="正在加载提醒" />;
  return (
    <TaskReminderForm
      key={`${reminder?.id ?? 'new'}:${reminder?.scheduleRevision ?? 0}`}
      task={task}
      reminder={reminder}
    />
  );
}

function TaskReminderForm({
  task,
  reminder,
}: {
  readonly task: SingleTask;
  readonly reminder: Reminder | undefined;
}) {
  const [target, setTarget] = useState<ReminderTarget>(
    reminder?.target ?? (task.plannedAt.kind !== 'none' ? 'planned' : 'deadline'),
  );
  const [offsetMinutes, setOffsetMinutes] = useState(reminder?.offsetMinutes ?? 0);
  const [saving, setSaving] = useState(false);
  const targetOptions = [
    ...(task.plannedAt.kind === 'none' ? [] : [{ value: 'planned', label: '计划时间' }]),
    ...(task.deadlineAt.kind === 'none'
      ? []
      : [{ value: 'deadline', label: '截止时间' }]),
  ];

  const save = async () => {
    setSaving(true);
    try {
      const services = await getApplicationServices();
      if (reminder === undefined) {
        await services.reminders.create({
          ownerKind: 'task',
          ownerId: task.id,
          target,
          offsetMinutes,
        });
      } else {
        await services.reminders.update(reminder.id, { target, offsetMinutes });
      }
      await services.reminderRuntime.reconcile();
      toast.success('提醒已保存');
    } catch {
      toast.error('提醒保存失败；任务安排保持不变。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (reminder === undefined) return;
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.reminders.remove(reminder.id);
      await services.reminderRuntime.reconcile();
      toast.success('提醒已关闭');
    } catch {
      toast.error('关闭提醒失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (targetOptions.length === 0) {
    return (
      <Alert>
        <Info />
        <AlertTitle>设置计划或截止时间后可添加提醒</AlertTitle>
      </Alert>
    );
  }
  return (
    <section className="task-reminder-editor" aria-labelledby="task-reminder-title">
      <h4 id="task-reminder-title" className="font-semibold">
        提醒
      </h4>
      <p className="text-sm text-muted-foreground">
        系统通知权限需要在设置页由你主动启用；应用内提醒不受拒绝权限影响。
      </p>
      <div className="flex flex-wrap gap-2">
        <SimpleSelect
          ariaLabel="提醒依据"
          value={target}
          options={targetOptions}
          onChange={(value) => {
            if (value === 'planned' || value === 'deadline') setTarget(value);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <Input
            aria-label="提前分钟数"
            className="w-24"
            type="number"
            min={0}
            step={5}
            value={offsetMinutes}
            onChange={(event) => setOffsetMinutes(Number(event.target.value) || 0)}
          />
          分钟前
        </label>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? '正在保存…' : reminder === undefined ? '添加提醒' : '更新提醒'}
        </Button>
        {reminder !== undefined ? (
          <Button disabled={saving} onClick={() => void remove()}>
            关闭提醒
          </Button>
        ) : null}
      </div>
    </section>
  );
}
