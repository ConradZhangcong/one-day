import { Alert, App, Button, InputNumber, Select, Space, Spin, Typography } from 'antd';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { getApplicationServices } from '@/app/application';
import type { Reminder, ReminderTarget, SingleTask } from '@/domain';

export function TaskReminderEditor({ task }: { readonly task: SingleTask }) {
  const reminders = useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.reminders.list('task', task.id);
  }, [task.id]);
  const reminder = reminders?.[0];
  if (reminders === undefined) return <Spin size="small" />;
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
  const { message } = App.useApp();
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
      void message.success('提醒已保存');
    } catch {
      void message.error('提醒保存失败；任务安排保持不变。');
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
      void message.success('提醒已关闭');
    } catch {
      void message.error('关闭提醒失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (targetOptions.length === 0) {
    return <Alert type="info" showIcon message="设置计划或截止时间后可添加提醒" />;
  }
  return (
    <section className="task-reminder-editor" aria-labelledby="task-reminder-title">
      <Typography.Title level={4} id="task-reminder-title">
        提醒
      </Typography.Title>
      <Typography.Text type="secondary">
        系统通知权限需要在设置页由你主动启用；应用内提醒不受拒绝权限影响。
      </Typography.Text>
      <Space wrap>
        <Select
          aria-label="提醒依据"
          value={target}
          options={targetOptions}
          onChange={(value: ReminderTarget) => setTarget(value)}
        />
        <InputNumber
          aria-label="提前分钟数"
          min={0}
          step={5}
          value={offsetMinutes}
          addonAfter="分钟前"
          onChange={(value) => setOffsetMinutes(value ?? 0)}
        />
        <Button type="primary" loading={saving} onClick={() => void save()}>
          {reminder === undefined ? '添加提醒' : '更新提醒'}
        </Button>
        {reminder !== undefined ? (
          <Button disabled={saving} onClick={() => void remove()}>
            关闭提醒
          </Button>
        ) : null}
      </Space>
    </section>
  );
}
