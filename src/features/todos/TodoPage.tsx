import {
  Check,
  Forward,
  ListTodo,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Temporal } from 'temporal-polyfill';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { CalendarItemView, TaskOccurrenceView } from '@/application';
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
  ClearableInput,
  EmptyState,
  SimpleSelect,
  TagBadge,
} from '@/components/ui/compat';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  decodeSchedulePoint,
  schedulePointLocalDate,
  type FixedRecurrenceRule,
  type LongTermGoal,
  type SchedulePoint,
  type SingleTask,
} from '@/domain';

import { ListManager } from './ListManager';
import { RecurrenceFields } from './RecurrenceFields';
import { OccurrenceDetailsDrawer } from './OccurrenceDetailsDrawer';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import {
  formatSchedule,
  getTodoView,
  projectTasks,
  taskFiltersFromSearchParams,
  type TodoViewKind,
} from './task-view';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import { useTodoSnapshot } from './useTodoSnapshot';

const VIEW_COPY: Record<TodoViewKind, { title: string; subtitle: string }> = {
  inbox: { title: '收件箱', subtitle: '先记下来，再慢慢整理。' },
  today: { title: '今天', subtitle: '计划或截止落在今天的任务。' },
  upcoming: { title: '即将到来', subtitle: '接下来有日期安排的任务。' },
  completed: { title: '已完成', subtitle: '已完成与已跳过的普通任务。' },
  list: { title: '清单', subtitle: '一个清晰的一级任务清单。' },
};

function toCalendarItem(item: TaskOccurrenceView): CalendarItemView | undefined {
  const schedule = item.plannedAt.kind !== 'none' ? item.plannedAt : item.deadlineAt;
  if (schedule.kind === 'none') return undefined;
  return {
    key: item.key,
    ownerKind: 'occurrence',
    ownerId: item.ownerId,
    ...(item.seriesId !== undefined ? { seriesId: item.seriesId } : {}),
    title: item.title,
    kind: item.plannedAt.kind !== 'none' ? 'planned' : 'deadline',
    schedule,
    ...(item.deadlineAt.kind !== 'none' ? { deadlineAt: item.deadlineAt } : {}),
    state: item.state,
    readonly: item.readonly,
    virtual: item.virtual,
    listId: item.listId,
    priority: item.priority,
  };
}

function QuickAdd({
  defaultListId,
  today,
  goals,
}: {
  readonly defaultListId: string;
  readonly today: string;
  readonly goals: readonly LongTermGoal[];
}) {
  const [title, setTitle] = useState('');
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>({ kind: 'none' });
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>({ kind: 'none' });
  const [saving, setSaving] = useState(false);
  const [goalId, setGoalId] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [rule, setRule] = useState<FixedRecurrenceRule>({
    frequency: 'daily',
    interval: 1,
    end: { kind: 'never' },
  });
  const recurrenceAnchor =
    plannedAt.kind !== 'none'
      ? plannedAt
      : deadlineAt.kind !== 'none'
        ? deadlineAt
        : undefined;

  const create = async () => {
    if (!title.trim()) {
      toast.warning('请输入任务标题');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      const draft = {
        title,
        notes: '',
        listId: defaultListId,
        tagNames: [],
        priority: 'none' as const,
        plannedAt,
        deadlineAt,
        ...(goalId ? { goalId } : {}),
      };
      if (recurring) await services.recurrence.createSeries({ ...draft, rule });
      else await services.todos.createTask(draft);
      setTitle('');
      setPlannedAt({ kind: 'none' });
      setDeadlineAt({ kind: 'none' });
      setGoalId('');
      setRecurring(false);
      toast.success(recurring ? '重复事项已创建' : '任务已加入');
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      toast.error(
        code === 'DEADLINE_BEFORE_PLAN'
          ? '截止时间不能早于计划时间。'
          : '创建失败，输入内容仍为你保留。',
      );
    } finally {
      setSaving(false);
    }
  };

  const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString();
  return (
    <form
      className="quick-add"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <div className="relative">
        <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          id="quick-add-title"
          aria-label="任务标题"
          className="h-11 pl-9"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="添加一件待办，按 Enter 保存"
        />
      </div>
      {recurring && plannedAt.kind === 'none' && deadlineAt.kind === 'none' ? (
        <p className="text-sm text-destructive">请先选择首次发生日期（计划或截止）。</p>
      ) : null}
      {recurring && recurrenceAnchor !== undefined ? (
        <RecurrenceFields anchor={recurrenceAnchor} rule={rule} onChange={setRule} />
      ) : null}
      <div className="quick-schedule">
        <span>计划</span>
        <input
          aria-label="快速计划日期"
          type="date"
          value={plannedAt.kind === 'allDay' ? plannedAt.date : ''}
          onChange={(event) =>
            setPlannedAt(
              event.target.value
                ? decodeSchedulePoint({ kind: 'allDay', date: event.target.value })
                : { kind: 'none' },
            )
          }
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPlannedAt(decodeSchedulePoint({ kind: 'allDay', date: today }))
          }
        >
          今天
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPlannedAt(decodeSchedulePoint({ kind: 'allDay', date: tomorrow }))
          }
        >
          明天
        </Button>
        <span>截止</span>
        <input
          aria-label="快速截止日期"
          type="date"
          value={deadlineAt.kind === 'allDay' ? deadlineAt.date : ''}
          onChange={(event) =>
            setDeadlineAt(
              event.target.value
                ? decodeSchedulePoint({ kind: 'allDay', date: event.target.value })
                : { kind: 'none' },
            )
          }
        />
        <SimpleSelect
          allowClear
          ariaLabel="关联长期目标"
          placeholder="关联目标"
          value={goalId || undefined}
          options={goals
            .filter((goal) => goal.status !== 'archived')
            .map((goal) => ({ value: goal.id, label: goal.title }))}
          onChange={(value) => setGoalId(typeof value === 'string' ? value : '')}
        />
        <Button
          type="button"
          variant={recurring ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setRecurring((value) => !value)}
        >
          <Repeat2 data-icon="inline-start" /> {recurring ? '收起重复' : '重复'}
        </Button>
        <Button
          type="submit"
          disabled={
            saving ||
            (recurring && plannedAt.kind === 'none' && deadlineAt.kind === 'none')
          }
        >
          {saving ? '正在添加…' : recurring ? '创建重复事项' : '添加'}
        </Button>
      </div>
    </form>
  );
}

export function TodoPage() {
  const snapshot = useTodoSnapshot();
  const location = useLocation();
  const navigate = useNavigate();
  const { listId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string>();
  const [managingLists, setManagingLists] = useState(false);
  const [removing, setRemoving] = useState<SingleTask>();
  const [removingBusy, setRemovingBusy] = useState(false);
  const [openedOccurrence, setOpenedOccurrence] = useState<TaskOccurrenceView>();
  const view = getTodoView(location.pathname);
  const today = useCurrentLocalDate(snapshot?.timeZone);

  const setFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const filteredTasks = useMemo(() => {
    if (snapshot === undefined || today === undefined) return [];
    return projectTasks(
      snapshot.tasks,
      view,
      today,
      taskFiltersFromSearchParams(searchParams),
      listId,
    );
  }, [listId, searchParams, snapshot, today, view]);
  const filteredOccurrences = useMemo(() => {
    if (snapshot === undefined || today === undefined || view === 'completed') return [];
    const filters = taskFiltersFromSearchParams(searchParams);
    return snapshot.occurrences.filter((item) => {
      const dates = [
        schedulePointLocalDate(item.plannedAt),
        schedulePointLocalDate(item.deadlineAt),
      ].filter(Boolean);
      if (view === 'inbox' && item.listId !== 'system:inbox') return false;
      if (view === 'list' && item.listId !== listId) return false;
      if (view === 'today' && !dates.includes(today)) return false;
      if (
        view === 'upcoming' &&
        !dates.some((date) => date !== undefined && date > today)
      )
        return false;
      if (
        filters.text &&
        !`${item.title}\n${item.notes}`
          .normalize('NFKC')
          .toLocaleLowerCase('zh-CN')
          .includes(filters.text.normalize('NFKC').toLocaleLowerCase('zh-CN'))
      )
        return false;
      if (filters.date && !dates.includes(filters.date)) return false;
      if (filters.listId && item.listId !== filters.listId) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      if (
        filters.tagIds.length > 0 &&
        !filters.tagIds.every((id) => item.tagIds.includes(id))
      )
        return false;
      return true;
    });
  }, [listId, searchParams, snapshot, today, view]);

  if (snapshot === undefined || today === undefined)
    return (
      <section className="todo-page grid gap-3">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
      </section>
    );

  const currentList = snapshot.lists.find((item) => item.id === listId);
  const editing = snapshot.tasks.find((task) => task.id === editingId);
  if (view === 'list' && currentList === undefined)
    return (
      <section className="todo-page rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">清单不存在</h1>
        <p className="mt-2 text-sm text-muted-foreground">这个清单可能已被删除。</p>
        <Button className="mt-4" onClick={() => navigate('/inbox')}>
          返回收件箱
        </Button>
      </section>
    );

  const copy =
    view === 'list'
      ? {
          title: currentList?.name ?? '清单',
          subtitle: currentList?.archived
            ? '此清单已归档，任务仍保留。'
            : VIEW_COPY.list.subtitle,
        }
      : VIEW_COPY[view];
  const defaultListId =
    view === 'list' && currentList !== undefined && !currentList.archived
      ? currentList.id
      : 'system:inbox';
  const openedCalendarItem =
    openedOccurrence === undefined ? undefined : toCalendarItem(openedOccurrence);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      toast.success(success);
    } catch {
      toast.error('操作失败，请重试。');
    }
  };

  const removeTask = async () => {
    if (removing === undefined) return;
    setRemovingBusy(true);
    try {
      await (await getApplicationServices()).todos.deleteTask(removing.id);
      toast.success('任务已删除');
      setRemoving(undefined);
    } catch {
      toast.error('删除失败，任务仍保留。');
    } finally {
      setRemovingBusy(false);
    }
  };

  return (
    <section className="todo-page">
      <header className="todo-header">
        <div>
          <p className="page-eyebrow">任务浏览</p>
          <h1>{copy.title}</h1>
          <p className="text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => setManagingLists(true)}>
          <ListTodo data-icon="inline-start" /> 管理清单
        </Button>
      </header>
      {view !== 'completed' ? (
        <QuickAdd defaultListId={defaultListId} today={today} goals={snapshot.goals} />
      ) : null}
      <div className="filter-bar" aria-label="任务筛选">
        <ClearableInput
          value={searchParams.get('q') ?? ''}
          onChange={(event) => setFilter('q', event.target.value)}
          placeholder="搜索标题或备注"
          aria-label="搜索任务"
        />
        <input
          type="date"
          aria-label="按日期筛选"
          value={searchParams.get('date') ?? ''}
          onChange={(event) => setFilter('date', event.target.value)}
        />
        <SimpleSelect
          allowClear
          ariaLabel="按清单筛选"
          placeholder="全部清单"
          value={searchParams.get('list') ?? undefined}
          options={snapshot.lists.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) =>
            setFilter('list', typeof value === 'string' ? value : undefined)
          }
        />
        <SimpleSelect
          multiple
          ariaLabel="按标签筛选"
          value={(searchParams.get('tags') ?? '').split(',').filter(Boolean)}
          options={snapshot.tags.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) =>
            setFilter('tags', Array.isArray(value) ? value.join(',') : undefined)
          }
        />
        <SimpleSelect
          allowClear
          ariaLabel="按优先级筛选"
          placeholder="全部优先级"
          value={searchParams.get('priority') ?? undefined}
          options={[
            { value: 'none', label: '无优先级' },
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
          ]}
          onChange={(value) =>
            setFilter('priority', typeof value === 'string' ? value : undefined)
          }
        />
        <SimpleSelect
          allowClear
          ariaLabel="按状态筛选"
          placeholder="全部状态"
          value={searchParams.get('state') ?? undefined}
          options={[
            { value: 'pending', label: '待处理' },
            { value: 'completed', label: '已完成' },
            { value: 'skipped', label: '已跳过' },
          ]}
          onChange={(value) =>
            setFilter('state', typeof value === 'string' ? value : undefined)
          }
        />
      </div>
      <div className="task-list" aria-live="polite">
        {filteredTasks.length === 0 && filteredOccurrences.length === 0 ? (
          <EmptyState
            description={
              searchParams.size > 0
                ? '没有符合筛选条件的任务'
                : view === 'completed'
                  ? '完成一件事后，会在这里留下记录'
                  : '这里还没有任务'
            }
          />
        ) : (
          <>
            {filteredTasks.map((task) => (
              <article className={`task-row state-${task.state}`} key={task.id}>
                <button
                  className="task-main"
                  onClick={() => setEditingId(task.id)}
                  aria-label={`编辑${task.title}`}
                >
                  <span className="task-state">
                    {task.state === 'pending'
                      ? '○ 待处理'
                      : task.state === 'completed'
                        ? '✓ 已完成'
                        : '↷ 已跳过'}
                  </span>
                  <strong>{task.title}</strong>
                  <small>{formatSchedule(task)}</small>
                  <span className="task-meta">
                    <Badge variant="secondary">
                      {snapshot.lists.find((item) => item.id === task.listId)?.name ??
                        '未知清单'}
                    </Badge>
                    {task.priority !== 'none' ? (
                      <Badge variant="outline">
                        {
                          ({ low: '低', medium: '中', high: '高' } as const)[
                            task.priority
                          ]
                        }
                        优先级
                      </Badge>
                    ) : null}
                    {task.tagIds.map((id) => {
                      const tag = snapshot.tags.find((item) => item.id === id);
                      return tag ? (
                        <TagBadge key={id} color={tag.color}>
                          {tag.name}
                        </TagBadge>
                      ) : null;
                    })}
                  </span>
                </button>
                <div className="flex flex-wrap gap-2">
                  {task.state === 'pending' ? (
                    <>
                      <Button
                        variant="outline"
                        aria-label={`完成${task.title}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (await getApplicationServices()).todos.setTaskState(
                                task.id,
                                'completed',
                              ),
                            '已完成',
                          )
                        }
                      >
                        <Check data-icon="inline-start" /> 完成
                      </Button>
                      <Button
                        variant="outline"
                        aria-label={`跳过${task.title}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (await getApplicationServices()).todos.setTaskState(
                                task.id,
                                'skipped',
                              ),
                            '已跳过',
                          )
                        }
                      >
                        <Forward data-icon="inline-start" /> 跳过
                      </Button>
                    </>
                  ) : null}
                  {task.state === 'completed' ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void run(
                          async () =>
                            (await getApplicationServices()).todos.undoTaskCompletion(
                              task.id,
                            ),
                          '已撤销完成',
                        )
                      }
                    >
                      <RotateCcw data-icon="inline-start" /> 撤销完成
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`编辑${task.title}`}
                    onClick={() => setEditingId(task.id)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label={`删除${task.title}`}
                    onClick={() => setRemoving(task)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            ))}
            {filteredOccurrences.map((item) => {
              const schedule =
                item.plannedAt.kind !== 'none' ? item.plannedAt : item.deadlineAt;
              if (schedule.kind === 'none') return null;
              return (
                <article className="task-row state-pending" key={item.key}>
                  <button
                    className="task-main"
                    onClick={() => setOpenedOccurrence(item)}
                    aria-label={`查看重复事项${item.title}`}
                  >
                    <span className="task-state">
                      {item.virtual ? '◇ 未来只读' : '↻ 当前实例'}
                    </span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.plannedAt.kind !== 'none'
                        ? `计划 ${schedulePointLocalDate(item.plannedAt)}`
                        : `截止 ${schedulePointLocalDate(item.deadlineAt)}`}
                    </small>
                    <span className="task-meta">
                      <Badge variant="secondary">
                        {item.virtual ? '未来只读' : '仅本次可操作'}
                      </Badge>
                    </span>
                  </button>
                </article>
              );
            })}
          </>
        )}
      </div>
      {editing ? (
        <TaskDetailsDrawer
          key={editing.id}
          task={editing}
          snapshot={snapshot}
          onClose={() => setEditingId(undefined)}
        />
      ) : null}
      {openedCalendarItem ? (
        <OccurrenceDetailsDrawer
          item={openedCalendarItem}
          onClose={() => setOpenedOccurrence(undefined)}
        />
      ) : null}
      <ListManager
        open={managingLists}
        lists={snapshot.lists}
        onClose={() => setManagingLists(false)}
      />
      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(value) => !value && setRemoving(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除“{removing?.title}”？</AlertDialogTitle>
            <AlertDialogDescription>
              此任务会从本设备明确删除，无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingBusy}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removingBusy}
              onClick={(event) => {
                event.preventDefault();
                void removeTask();
              }}
            >
              {removingBusy ? '正在删除…' : '删除任务'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
