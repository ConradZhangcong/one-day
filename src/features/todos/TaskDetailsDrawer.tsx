import { Check, Forward, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { TodoSnapshot } from '@/application';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/compat';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Priority, SchedulePoint, SingleTask } from '@/domain';

import { SubtaskEditor } from './SubtaskEditor';
import { cleanSubtasks } from './subtasks';
import { ScheduleFields } from './ScheduleFields';
import { TaskReminderEditor } from './TaskReminderEditor';
import { todayInTimeZone } from './task-view';

interface Props {
  readonly snapshot: TodoSnapshot;
  readonly task: SingleTask;
  readonly onClose: () => void;
}

export function TaskDetailsDrawer({ onClose, snapshot, task }: Props) {
  const tagNames = task.tagIds
    .map((id) => snapshot.tags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const [title, setTitle] = useState(task.title);
  const [subtasks, setSubtasks] = useState(task.subtasks ?? []);
  const [notes, setNotes] = useState(task.notes);
  const [listId, setListId] = useState(task.listId);
  const [draftTags, setDraftTags] = useState<string[]>(tagNames);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(task.plannedAt);
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(task.deadlineAt);
  const [saving, setSaving] = useState(false);
  const [goalId, setGoalId] = useState(task.goalId ?? '');
  const [initialTask] = useState(() => JSON.stringify(task));
  const today = todayInTimeZone(snapshot.timeZone);
  const taskChanged = JSON.stringify(task) !== initialTask;
  const selectedList = snapshot.lists.find((list) => list.id === listId);
  const invalidList = selectedList === undefined || selectedList.archived;

  const save = async () => {
    if (taskChanged) {
      toast.warning('任务已在其他位置更新，请关闭后重新打开。');
      return;
    }
    if (invalidList) {
      toast.warning('所选清单已删除或归档，请重新选择。');
      return;
    }
    if (!title.trim()) {
      toast.warning('请输入任务标题');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.todos.updateTask(task.id, {
        title,
        notes,
        subtasks: cleanSubtasks(subtasks),
        listId,
        tagNames: draftTags,
        priority,
        plannedAt,
        deadlineAt,
        ...(goalId ? { goalId } : {}),
      });
      toast.success('任务已保存');
      onClose();
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      toast.error(
        code === 'DEADLINE_BEFORE_PLAN'
          ? '截止时间不能早于计划时间。'
          : '保存失败，请检查输入后重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  const setState = async (state: 'completed' | 'skipped') => {
    setSaving(true);
    try {
      await (await getApplicationServices()).todos.setTaskState(task.id, state);
      toast.success(state === 'completed' ? '任务已完成' : '任务已跳过');
      onClose();
    } catch {
      toast.error('操作失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent className="task-detail-dialog max-h-[90dvh] sm:max-w-2xl">
        <DialogHeader className="border-b">
          <DialogTitle>任务详情</DialogTitle>
          <DialogDescription>
            无计划或截止时间时为长期任务；添加时间后按日期安排。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="detail-form px-4 pb-4">
            {taskChanged ? (
              <Alert>
                <TriangleAlert />
                <AlertTitle>任务已更新</AlertTitle>
                <AlertDescription>
                  为避免覆盖新内容，请关闭详情后重新打开。
                </AlertDescription>
              </Alert>
            ) : null}
            {invalidList ? (
              <Alert>
                <TriangleAlert />
                <AlertTitle>原清单已不可用</AlertTitle>
                <AlertDescription>请选择一个仍可用的清单后再保存。</AlertDescription>
              </Alert>
            ) : null}
            <label>
              标题
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void save();
                }}
              />
            </label>
            <SubtaskEditor
              value={subtasks}
              onChange={setSubtasks}
              disabled={saving}
              readOnly={task.state !== 'pending'}
            />
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
            <details className="detail-more">
              <summary>更多信息 · 清单、优先级与备注</summary>
              <div className="detail-more-fields">
                {' '}
                <label>
                  备注
                  <Textarea
                    value={notes}
                    rows={5}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="纯文本备注"
                  />
                </label>
                <label>
                  清单
                  <SimpleSelect
                    ariaLabel="清单"
                    className="w-full"
                    value={listId}
                    options={snapshot.lists
                      .filter((list) => !list.archived)
                      .map((list) => ({ value: list.id, label: list.name }))}
                    onChange={(value) => {
                      if (typeof value === 'string') setListId(value);
                    }}
                  />
                </label>
                <label>
                  标签
                  <Input
                    value={draftTags.join('，')}
                    onChange={(event) =>
                      setDraftTags(
                        event.target.value
                          .split(/[,，]/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="用逗号分隔多个标签"
                  />
                </label>
                <label>
                  优先级
                  <SimpleSelect
                    ariaLabel="优先级"
                    value={priority}
                    options={[
                      { value: 'none', label: '无' },
                      { value: 'low', label: '低' },
                      { value: 'medium', label: '中' },
                      { value: 'high', label: '高' },
                    ]}
                    onChange={(value) => {
                      if (typeof value === 'string') setPriority(value);
                    }}
                  />
                </label>
                <label>
                  关联任务
                  <SimpleSelect
                    allowClear
                    ariaLabel="关联任务"
                    className="w-full"
                    placeholder="不关联任务"
                    value={goalId || undefined}
                    options={snapshot.goals
                      .filter(
                        (goal) =>
                          goal.id !== task.id &&
                          (goal.status !== 'archived' || goal.id === task.goalId),
                      )
                      .map((goal) => ({ value: goal.id, label: goal.title }))}
                    onChange={(value) =>
                      setGoalId(typeof value === 'string' ? value : '')
                    }
                  />
                </label>
              </div>
            </details>
            {snapshot.tasks.some((linked) => linked.goalId === task.id) && (
              <section className="grid gap-2" aria-label="关联任务列表">
                <strong>关联任务</strong>
                {snapshot.tasks
                  .filter((linked) => linked.goalId === task.id)
                  .map((linked) => (
                    <div key={linked.id} className="flex justify-between gap-2">
                      <span>{linked.title}</span>
                      <span>
                        {linked.state === 'completed'
                          ? '已完成'
                          : linked.state === 'skipped'
                            ? '已跳过'
                            : linked.paused
                              ? '已暂停'
                              : '待处理'}
                      </span>
                    </div>
                  ))}
              </section>
            )}
            <TaskReminderEditor task={task} />
          </div>
        </DialogBody>
        <DialogFooter className="border-t bg-background">
          <div className="flex flex-wrap justify-end gap-2">
            {task.state === 'pending' ? (
              <>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void setState('completed')}
                >
                  <Check data-icon="inline-start" /> 完成
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void setState('skipped')}
                >
                  <Forward data-icon="inline-start" /> 跳过
                </Button>
              </>
            ) : null}
            <Button variant="outline" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={saving || taskChanged || invalidList}
              onClick={() => void save()}
            >
              {saving ? '正在保存…' : '保存更改'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
