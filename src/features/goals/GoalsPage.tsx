import { Archive, CheckCircle2, Circle, Pencil, Plus, Target } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import { useApplicationRevision } from '@/app/application-change';
import type { GoalDraft, GoalProgress as GoalProgressItem } from '@/application';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/compat';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { longTermGoalStatusSchema, type LongTermGoalStatus } from '@/domain';
import { TaskDetailsDrawer } from '@/features/todos/TaskDetailsDrawer';
import { useTodoSnapshot } from '@/features/todos/useTodoSnapshot';

const STATUS_COPY: Record<LongTermGoalStatus, string> = {
  planned: '计划中',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

function GoalEditor({
  item,
  onClose,
}: {
  readonly item?: GoalProgressItem;
  readonly onClose: () => void;
}) {
  const [title, setTitle] = useState(item?.goal.title ?? '');
  const [description, setDescription] = useState(item?.goal.description ?? '');
  const [status, setStatus] = useState<LongTermGoalStatus>(item?.goal.status ?? 'active');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      toast.warning('请输入目标名称');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      const draft: GoalDraft = {
        title,
        description,
        status,
      };
      if (item === undefined) await services.goals.create(draft);
      else await services.goals.update(item.goal.id, draft);
      toast.success(item === undefined ? '长期目标已创建' : '长期目标已更新');
      onClose();
    } catch {
      toast.error('保存失败，请检查输入后重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item === undefined ? '新建长期目标' : '编辑长期目标'}
          </DialogTitle>
          <DialogDescription>进度由关联任务的完成情况自动计算。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-2">
          <label className="grid gap-2 text-sm font-medium">
            目标名称
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            说明
            <Textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            状态
            <NativeSelect
              className="w-full"
              value={status}
              onChange={(event) =>
                setStatus(longTermGoalStatusSchema.parse(event.target.value))
              }
            >
              {Object.entries(STATUS_COPY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? '正在保存…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsPage() {
  const applicationRevision = useApplicationRevision();
  const goals = useLiveQuery(
    async () => (await getApplicationServices()).goals.snapshot(),
    [applicationRevision],
  );
  const todoSnapshot = useTodoSnapshot();
  const [editing, setEditing] = useState<GoalProgressItem | 'new'>();
  const [openedTaskId, setOpenedTaskId] = useState<string>();

  if (goals === undefined)
    return (
      <section className="grid gap-4">
        <Skeleton className="h-20 w-80" />
        <Skeleton className="h-48 w-full" />
      </section>
    );

  return (
    <section className="goals-page">
      <header className="todo-header">
        <div>
          <h1>长期目标</h1>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus data-icon="inline-start" />
          新建目标
        </Button>
      </header>
      {goals.length === 0 ? (
        <EmptyState description="还没有长期目标。建立一个方向，再从任务详情中关联具体行动。" />
      ) : (
        <div className="goal-grid">
          {goals.map((item) => (
            <Card
              key={item.goal.id}
              className={item.goal.status === 'archived' ? 'opacity-65' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-4" />
                    {item.goal.title}
                  </CardTitle>
                  <Badge variant="secondary">{STATUS_COPY[item.goal.status]}</Badge>
                </div>
                {item.goal.description ? (
                  <p className="text-sm text-muted-foreground">{item.goal.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-3">
                <Progress value={item.percent} aria-label={`${item.goal.title}完成度`} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {item.completedTasks} / {item.totalTasks} 个任务完成
                  </span>
                  <strong className="text-foreground">{item.percent}%</strong>
                </div>
                {item.linkedTasks.length > 0 ? (
                  <div className="goal-task-list">
                    {item.linkedTasks.map((task) => (
                      <button key={task.id} onClick={() => setOpenedTaskId(task.id)}>
                        {task.state === 'completed' ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                        <span>{task.title}</span>
                        <Badge variant="outline">
                          {task.state === 'completed'
                            ? '已完成'
                            : task.state === 'skipped'
                              ? '已跳过'
                              : '待处理'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">尚未关联任务</p>
                )}
              </CardContent>
              <CardFooter className="justify-end gap-2">
                {item.goal.status !== 'archived' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void (async () => {
                        await (
                          await getApplicationServices()
                        ).goals.update(item.goal.id, {
                          title: item.goal.title,
                          description: item.goal.description,
                          status: 'archived',
                        });
                        toast.success('目标已归档');
                      })()
                    }
                  >
                    <Archive data-icon="inline-start" />
                    归档
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                  <Pencil data-icon="inline-start" />
                  编辑
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      {editing ? (
        <GoalEditor
          {...(editing === 'new' ? {} : { item: editing })}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {openedTaskId && todoSnapshot
        ? (() => {
            const task = todoSnapshot.tasks.find((item) => item.id === openedTaskId);
            return task ? (
              <TaskDetailsDrawer
                task={task}
                snapshot={todoSnapshot}
                onClose={() => setOpenedTaskId(undefined)}
              />
            ) : null;
          })()
        : null}
    </section>
  );
}
