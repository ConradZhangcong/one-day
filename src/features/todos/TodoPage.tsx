import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  ForwardOutlined,
  PlusOutlined,
  RollbackOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Temporal } from 'temporal-polyfill';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { getApplicationServices } from '@/app/application';
import { decodeSchedulePoint, type SchedulePoint, type SingleTask } from '@/domain';

import { ListManager } from './ListManager';
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

function QuickAdd({
  defaultListId,
  today,
}: {
  readonly defaultListId: string;
  readonly today: string;
}) {
  const { message } = App.useApp();
  const [title, setTitle] = useState('');
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>({ kind: 'none' });
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>({ kind: 'none' });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      void message.warning('请输入任务标题');
      return;
    }
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.todos.createTask({
        title,
        notes: '',
        listId: defaultListId,
        tagNames: [],
        priority: 'none',
        plannedAt,
        deadlineAt,
      });
      setTitle('');
      setPlannedAt({ kind: 'none' });
      setDeadlineAt({ kind: 'none' });
      void message.success('任务已加入');
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      void message.error(
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
      <Input
        autoFocus
        aria-label="任务标题"
        size="large"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="添加一件待办，按 Enter 保存"
        prefix={<PlusOutlined />}
      />
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
          size="small"
          onClick={() =>
            setPlannedAt(decodeSchedulePoint({ kind: 'allDay', date: today }))
          }
        >
          今天
        </Button>
        <Button
          size="small"
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
        <Button htmlType="submit" type="primary" loading={saving}>
          添加
        </Button>
      </div>
    </form>
  );
}

export function TodoPage() {
  const snapshot = useTodoSnapshot();
  const { message, modal } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { listId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string>();
  const [managingLists, setManagingLists] = useState(false);
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

  if (snapshot === undefined || today === undefined)
    return (
      <section className="todo-page">
        <Skeleton active />
      </section>
    );
  const currentList = snapshot.lists.find((item) => item.id === listId);
  const editing = snapshot.tasks.find((task) => task.id === editingId);
  if (view === 'list' && currentList === undefined)
    return (
      <section className="todo-page">
        <Alert
          type="error"
          showIcon
          message="清单不存在"
          action={<Button onClick={() => navigate('/inbox')}>返回收件箱</Button>}
        />
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

  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      void message.success(success);
    } catch {
      void message.error('操作失败，请重试。');
    }
  };
  const removeTask = (task: SingleTask) =>
    modal.confirm({
      title: `永久删除“${task.title}”？`,
      content: '此任务会从本设备明确删除，无法撤销。',
      okText: '删除任务',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () =>
        run(
          async () => (await getApplicationServices()).todos.deleteTask(task.id),
          '任务已删除',
        ),
    });

  return (
    <section className="todo-page">
      <header className="todo-header">
        <div>
          <Typography.Title>{copy.title}</Typography.Title>
          <Typography.Text type="secondary">{copy.subtitle}</Typography.Text>
        </div>
        <Button icon={<SettingOutlined />} onClick={() => setManagingLists(true)}>
          管理清单
        </Button>
      </header>
      {view !== 'completed' ? (
        <QuickAdd defaultListId={defaultListId} today={today} />
      ) : null}
      <div className="filter-bar" aria-label="任务筛选">
        <Input
          allowClear
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
        <Select
          allowClear
          aria-label="按清单筛选"
          placeholder="全部清单"
          value={searchParams.get('list') ?? undefined}
          options={snapshot.lists.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value?: string) => setFilter('list', value)}
        />
        <Select
          mode="multiple"
          allowClear
          aria-label="按标签筛选"
          placeholder="全部标签"
          value={(searchParams.get('tags') ?? '').split(',').filter(Boolean)}
          options={snapshot.tags.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(values: string[]) => setFilter('tags', values.join(','))}
        />
        <Select
          allowClear
          aria-label="按优先级筛选"
          placeholder="全部优先级"
          value={searchParams.get('priority') ?? undefined}
          options={[
            { value: 'none', label: '无优先级' },
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
          ]}
          onChange={(value?: string) => setFilter('priority', value)}
        />
        <Select
          allowClear
          aria-label="按状态筛选"
          placeholder="全部状态"
          value={searchParams.get('state') ?? undefined}
          options={[
            { value: 'pending', label: '待处理' },
            { value: 'completed', label: '已完成' },
            { value: 'skipped', label: '已跳过' },
          ]}
          onChange={(value?: string) => setFilter('state', value)}
        />
      </div>
      <div className="task-list" aria-live="polite">
        {filteredTasks.length === 0 ? (
          <Empty
            description={
              searchParams.size > 0
                ? '没有符合筛选条件的任务'
                : view === 'completed'
                  ? '完成一件事后，会在这里留下记录'
                  : '这里还没有任务'
            }
          />
        ) : (
          filteredTasks.map((task) => (
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
                  <Tag>
                    {snapshot.lists.find((item) => item.id === task.listId)?.name ??
                      '未知清单'}
                  </Tag>
                  {task.priority !== 'none' ? (
                    <Tag>
                      {({ low: '低', medium: '中', high: '高' } as const)[task.priority]}
                      优先级
                    </Tag>
                  ) : null}
                  {task.tagIds.map((id) => {
                    const tag = snapshot.tags.find((item) => item.id === id);
                    return tag ? (
                      <Tag key={id} color={tag.color}>
                        {tag.name}
                      </Tag>
                    ) : null;
                  })}
                </span>
              </button>
              <Space wrap>
                {task.state === 'pending' ? (
                  <>
                    <Button
                      aria-label={`完成${task.title}`}
                      icon={<CheckOutlined />}
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
                      完成
                    </Button>
                    <Button
                      aria-label={`跳过${task.title}`}
                      icon={<ForwardOutlined />}
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
                      跳过
                    </Button>
                  </>
                ) : null}
                {task.state === 'completed' ? (
                  <Button
                    icon={<RollbackOutlined />}
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
                    撤销完成
                  </Button>
                ) : null}
                <Button
                  aria-label={`编辑${task.title}`}
                  icon={<EditOutlined />}
                  onClick={() => setEditingId(task.id)}
                />
                <Button
                  danger
                  aria-label={`删除${task.title}`}
                  icon={<DeleteOutlined />}
                  onClick={() => removeTask(task)}
                />
              </Space>
            </article>
          ))
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
      <ListManager
        open={managingLists}
        lists={snapshot.lists}
        onClose={() => setManagingLists(false)}
      />
    </section>
  );
}
