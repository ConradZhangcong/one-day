import { Alert, App, Button, Drawer, Input, Select, Space } from 'antd';
import { useState } from 'react';

import { getApplicationServices } from '@/app/application';
import type { TodoSnapshot } from '@/application';
import type { Priority, SchedulePoint, SingleTask } from '@/domain';

import { ScheduleFields } from './ScheduleFields';
import { TaskReminderEditor } from './TaskReminderEditor';
import { todayInTimeZone } from './task-view';

interface Props {
  readonly snapshot: TodoSnapshot;
  readonly task: SingleTask;
  readonly onClose: () => void;
}

export function TaskDetailsDrawer({ onClose, snapshot, task }: Props) {
  const { message } = App.useApp();
  const tagNames = task.tagIds
    .map((id) => snapshot.tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [listId, setListId] = useState(task.listId);
  const [draftTags, setDraftTags] = useState<string[]>(tagNames);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(task.plannedAt);
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(task.deadlineAt);
  const [saving, setSaving] = useState(false);
  const [initialTask] = useState(() => JSON.stringify(task));
  const today = todayInTimeZone(snapshot.timeZone);
  const taskChanged = JSON.stringify(task) !== initialTask;
  const selectedList = snapshot.lists.find((list) => list.id === listId);
  const invalidList = selectedList === undefined || selectedList.archived;

  const save = async () => {
    if (taskChanged) {
      void message.warning('任务已在其他位置更新，请关闭后重新打开。');
      return;
    }
    if (invalidList) {
      void message.warning('所选清单已删除或归档，请重新选择。');
      return;
    }
    if (!title.trim()) {
      void message.warning('请输入任务标题');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.todos.updateTask(task.id, {
        title,
        notes,
        listId,
        tagNames: draftTags,
        priority,
        plannedAt,
        deadlineAt,
      });
      void message.success('任务已保存');
      onClose();
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      void message.error(
        code === 'DEADLINE_BEFORE_PLAN'
          ? '截止时间不能早于计划时间。'
          : '保存失败，请检查输入后重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      title="任务详情"
      onClose={() => {
        if (!saving) onClose();
      }}
      closable={!saving}
      keyboard={!saving}
      maskClosable={!saving}
      width={520}
      extra={
        <Button
          type="primary"
          loading={saving}
          disabled={taskChanged || invalidList}
          onClick={() => void save()}
        >
          保存
        </Button>
      }
    >
      <div className="detail-form">
        {taskChanged ? (
          <Alert
            type="warning"
            showIcon
            message="任务已更新"
            description="为避免覆盖新内容，请关闭详情后重新打开。"
          />
        ) : null}
        {invalidList ? (
          <Alert
            type="warning"
            showIcon
            message="原清单已不可用"
            description="请选择一个仍可用的清单后再保存。"
          />
        ) : null}
        <label>
          标题
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onPressEnter={() => void save()}
          />
        </label>
        <label>
          备注
          <Input.TextArea
            value={notes}
            rows={5}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="纯文本备注"
          />
        </label>
        <label>
          清单
          <Select
            value={listId}
            options={snapshot.lists
              .filter((list) => !list.archived)
              .map((list) => ({ value: list.id, label: list.name }))}
            onChange={setListId}
          />
        </label>
        <label>
          标签
          <Select
            mode="tags"
            value={draftTags}
            tokenSeparators={[',', '，']}
            options={snapshot.tags.map((tag) => ({ value: tag.name, label: tag.name }))}
            onChange={setDraftTags}
            placeholder="输入后回车创建标签"
          />
        </label>
        <label>
          优先级
          <Select
            value={priority}
            options={[
              { value: 'none', label: '无' },
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
            ]}
            onChange={setPriority}
          />
        </label>
        <ScheduleFields
          label="计划"
          value={plannedAt}
          defaultDate={today}
          timeZone={snapshot.timeZone}
          onChange={setPlannedAt}
        />
        <ScheduleFields
          label="截止"
          value={deadlineAt}
          defaultDate={today}
          timeZone={snapshot.timeZone}
          onChange={setDeadlineAt}
        />
        <TaskReminderEditor task={task} />
        <Space>
          <Button disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={taskChanged || invalidList}
            onClick={() => void save()}
          >
            保存更改
          </Button>
        </Space>
      </div>
    </Drawer>
  );
}
