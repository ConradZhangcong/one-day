import { PageActions } from '@/app/PageActions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Check,
  Forward,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { SYSTEM_INBOX_ID, occurrenceKeySchema, type SingleTask } from '@/domain';

import { QuickAdd } from './QuickAdd';
export { QuickAdd } from './QuickAdd';
import { ListManager } from './ListManager';
import { OccurrenceDetailsDrawer } from './OccurrenceDetailsDrawer';
import { SeriesManager } from './SeriesManager';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import {
  formatCompletedAt,
  formatSchedule,
  getTodoView,
  projectTodoRows,
  taskFiltersFromSearchParams,
  type TodoRow,
  type TodoViewKind,
} from './task-view';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import { useTodoSnapshot } from './useTodoSnapshot';

const VIEW_TITLES: Record<TodoViewKind, string> = {
  inbox: '收件箱',
  today: '今天',
  upcoming: '即将到来',
  completed: '已处理',
  list: '清单',
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

export function TodoPage() {
  const snapshot = useTodoSnapshot();
  const location = useLocation();
  const navigate = useNavigate();
  const { listId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string>();
  const [managingLists, setManagingLists] = useState(false);
  const [managingSeries, setManagingSeries] = useState(false);
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

  const rows = useMemo(() => {
    if (snapshot === undefined || today === undefined) return [];
    return projectTodoRows(
      snapshot.tasks,
      snapshot.occurrences,
      view,
      today,
      taskFiltersFromSearchParams(searchParams),
      listId,
      snapshot.timeZone,
    );
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

  const title = view === 'list' ? (currentList?.name ?? '清单') : VIEW_TITLES[view];
  const defaultListId =
    view === 'list' && currentList !== undefined && !currentList.archived
      ? currentList.id
      : SYSTEM_INBOX_ID;
  const openedCalendarItem =
    openedOccurrence === undefined ? undefined : toCalendarItem(openedOccurrence);
  const openedSeries = snapshot.series.find(
    (item) => item.id === openedCalendarItem?.seriesId,
  );

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
          <p className="page-eyebrow">{today}</p>
          <h1>{title}</h1>
          {currentList?.archived ? (
            <p className="text-muted-foreground">此清单已归档，任务仍保留。</p>
          ) : null}
        </div>
        <PageActions defaultListId={defaultListId} />
      </header>
      {view !== 'completed' ? (
        <QuickAdd
          key={`${defaultListId}:${searchParams.get('goal') ?? ''}`}
          defaultListId={defaultListId}
          today={today}
          goals={snapshot.goals}
          defaultGoalId={searchParams.get('goal') ?? ''}
        />
      ) : null}
      <div className="list-toolbar">
        <h2>
          {view === 'today' ? '今天待办' : '任务列表'}{' '}
          <span>
            {rows.filter((row) => view !== 'today' || row.state !== 'completed').length}
          </span>
        </h2>
        <Popover>
          <PopoverTrigger aria-label="管理任务与清单" className="list-manage-trigger">
            <MoreHorizontal size={18} />
          </PopoverTrigger>
          <PopoverContent align="end">
            {' '}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setManagingSeries(true)}>
                <Repeat2 data-icon="inline-start" /> 管理重复系列
              </Button>
              <Button variant="outline" onClick={() => setManagingLists(true)}>
                <ListTodo data-icon="inline-start" /> 管理清单
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <details className="filter-panel">
        <summary>
          筛选
          {['q', 'date', 'list', 'tags', 'priority', 'state'].some((key) =>
            searchParams.has(key),
          )
            ? ' · 已启用'
            : ''}
        </summary>
        <Button
          variant="ghost"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            ['q', 'date', 'list', 'tags', 'priority', 'state'].forEach((key) =>
              next.delete(key),
            );
            setSearchParams(next, { replace: true });
          }}
        >
          清除全部筛选
        </Button>
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
            placeholder={
              view === 'completed'
                ? '已完成与已跳过'
                : view === 'today'
                  ? '当天待办与今天完成'
                  : '待处理'
            }
            value={searchParams.get('state') ?? undefined}
            options={[
              { value: 'all', label: '全部状态' },
              ...(view === 'completed' ? [] : [{ value: 'pending', label: '待处理' }]),
              { value: 'completed', label: '已完成' },
              { value: 'skipped', label: '已跳过' },
            ]}
            onChange={(value) =>
              setFilter('state', typeof value === 'string' ? value : undefined)
            }
          />
        </div>
      </details>
      <div className="flex flex-wrap gap-2" aria-label="已选筛选条件">
        {(['q', 'date', 'list', 'tags', 'priority', 'state'] as const)
          .filter((key) => searchParams.has(key))
          .map((key) => {
            const value = searchParams.get(key) ?? '';
            const label =
              key === 'list'
                ? (snapshot.lists.find((item) => item.id === value)?.name ?? value)
                : key === 'tags'
                  ? value
                      .split(',')
                      .map((id) => snapshot.tags.find((tag) => tag.id === id)?.name ?? id)
                      .join('、')
                  : ((
                      {
                        pending: '待处理',
                        completed: '已完成',
                        skipped: '已跳过',
                        all: '全部状态',
                        high: '高',
                        medium: '中',
                        low: '低',
                        none: '无',
                      } as Record<string, string>
                    )[value] ?? value);
            return (
              <Button
                key={key}
                size="sm"
                variant="secondary"
                onClick={() => setFilter(key)}
                aria-label={`清除${label}筛选`}
              >
                {label} ×
              </Button>
            );
          })}
      </div>
      {view === 'today' ? (
        <button className="recovery-entry" onClick={() => navigate('/recovery')}>
          <RotateCcw size={16} />
          <span>重新安排错过或逾期的事项</span>
          <strong>查看待恢复 →</strong>
        </button>
      ) : null}
      <div className="task-list" aria-live="polite">
        {rows.length === 0 ? (
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
          [
            view === 'today' ? rows.filter((row) => row.state !== 'completed') : rows,
            ...(view === 'today'
              ? [rows.filter((row) => row.state === 'completed')]
              : []),
          ].map((group, index) => {
            const content = group.map((row: TodoRow) => {
              const task = row.kind === 'task' ? row.task : undefined;
              const completion = formatCompletedAt(row.completedAt, snapshot.timeZone);
              return (
                <article
                  className={`task-row state-${row.state}${row.kind === 'occurrence' ? ' task-row-recurring' : ''}`}
                  key={row.key}
                >
                  <button
                    className="task-check"
                    disabled={row.readonly || row.state !== 'pending'}
                    aria-label={`完成${row.title}`}
                    onClick={() => {
                      if (task)
                        void run(
                          async () =>
                            (await getApplicationServices()).todos.setTaskState(
                              task.id,
                              'completed',
                            ),
                          '已完成',
                        );
                      else if (row.kind === 'occurrence')
                        void run(
                          async () =>
                            (
                              await getApplicationServices()
                            ).recurrence.completeOccurrence(
                              occurrenceKeySchema.parse(row.occurrence.ownerId),
                            ),
                          '本次已完成',
                        );
                    }}
                  >
                    {row.state === 'completed' ? (
                      <Check size={15} />
                    ) : row.state === 'skipped' ? (
                      <Forward size={15} />
                    ) : null}
                  </button>
                  <button
                    className="task-main"
                    onClick={() => {
                      if (row.kind === 'task') setEditingId(row.task.id);
                      else setOpenedOccurrence(row.occurrence);
                    }}
                    aria-label={`${row.kind === 'task' ? '编辑' : '查看重复事项'}${row.title}`}
                  >
                    <span className="task-state sr-only">
                      {row.state === 'pending'
                        ? '○ 待处理'
                        : row.state === 'completed'
                          ? '✓ 已完成'
                          : '↷ 已跳过'}
                    </span>
                    <strong>{row.title}</strong>
                    <small className="task-schedule">{formatSchedule(row)}</small>
                    {completion ? (
                      <small className="task-completion">{completion}</small>
                    ) : null}
                    <span className="task-meta">
                      <Badge variant="secondary">
                        {snapshot.lists.find((item) => item.id === row.listId)?.name ??
                          '未知清单'}
                      </Badge>
                      {row.priority !== 'none' ? (
                        <Badge variant="outline">
                          {
                            ({ low: '低', medium: '中', high: '高' } as const)[
                              row.priority
                            ]
                          }
                          优先级
                        </Badge>
                      ) : null}
                      {row.kind === 'occurrence' ? (
                        <>
                          <Badge className="task-recurring-badge">
                            <Repeat2 data-icon="inline-start" aria-hidden="true" />
                            重复任务
                          </Badge>
                          <Badge variant="secondary">
                            {row.state !== 'pending'
                              ? '历史只读'
                              : row.virtual
                                ? '未来只读'
                                : '本次安排'}
                          </Badge>
                        </>
                      ) : null}
                      {row.tagIds.map((id) => {
                        const tag = snapshot.tags.find((item) => item.id === id);
                        return tag ? (
                          <TagBadge key={id} color={tag.color}>
                            {tag.name}
                          </TagBadge>
                        ) : null;
                      })}
                    </span>
                  </button>
                  {task ? (
                    <Popover>
                      <PopoverTrigger
                        className="task-more"
                        aria-label={`更多操作：${task.title}`}
                      >
                        <MoreHorizontal size={18} />
                      </PopoverTrigger>
                      <PopoverContent align="end" className="task-action-menu">
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
                                  (
                                    await getApplicationServices()
                                  ).todos.undoTaskCompletion(task.id),
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
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </article>
              );
            });
            return index === 1 ? (
              <details key="completed-today" className="today-completed">
                <summary>今天完成 · {group.length}</summary>
                {content}
              </details>
            ) : (
              <div key="pending" className="task-list">
                {content}
              </div>
            );
          })
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
          {...(openedSeries !== undefined ? { series: openedSeries } : {})}
          snapshot={snapshot}
          onClose={() => setOpenedOccurrence(undefined)}
        />
      ) : null}
      <SeriesManager
        open={managingSeries}
        snapshot={snapshot}
        onClose={() => setManagingSeries(false)}
      />
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
