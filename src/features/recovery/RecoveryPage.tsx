import {
  CheckOutlined,
  ClockCircleOutlined,
  ForwardOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Empty, Modal, Space, Spin, Tag, Typography } from 'antd';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { getApplicationServices } from '@/app/application';
import type { RecoverySnapshot, RecoveryTaskView } from '@/application';
import {
  schedulePointLocalDate,
  validateScheduleOrder,
  type SchedulePoint,
} from '@/domain';
import { ScheduleFields } from '@/features/todos/ScheduleFields';
import { formatSchedule } from '@/features/todos/task-view';

import { useClockTick } from './useClockTick';

type RecoveryKind = 'missed' | 'overdue';

interface RescheduleDialogProps {
  readonly item: RecoveryTaskView;
  readonly snapshot: RecoverySnapshot;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

function isDomainCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && String(error.code) === code;
}

function sameLocalDate(left: SchedulePoint, right: SchedulePoint): boolean {
  const leftDate = schedulePointLocalDate(left);
  return leftDate !== undefined && leftDate === schedulePointLocalDate(right);
}

function RescheduleDialog({ item, onCancel, onSaved, snapshot }: RescheduleDialogProps) {
  const { message } = App.useApp();
  const [plannedAt, setPlannedAt] = useState<SchedulePoint>(item.task.plannedAt);
  const [deadlineAt, setDeadlineAt] = useState<SchedulePoint>(item.task.deadlineAt);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const validation = useMemo(
    () => validateScheduleOrder(plannedAt, deadlineAt, snapshot.timeZone),
    [deadlineAt, plannedAt, snapshot.timeZone],
  );
  const mixedSameDay =
    plannedAt.kind !== 'none' &&
    deadlineAt.kind !== 'none' &&
    plannedAt.kind !== deadlineAt.kind &&
    sameLocalDate(plannedAt, deadlineAt);

  const save = async () => {
    setSaveError(undefined);
    if (!validation.ok) {
      setSaveError('截止时间不能早于计划时间。原时间仍然保留。');
      return;
    }

    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.recovery.rescheduleTask(item.task.id, { plannedAt, deadlineAt });
      void message.success('已按新时间重新安排');
      onSaved();
    } catch (error) {
      setSaveError(
        isDomainCode(error, 'DEADLINE_BEFORE_PLAN')
          ? '截止时间不能早于计划时间。原时间仍然保留。'
          : '重新安排失败，草稿和原任务时间都已保留，请重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`重新安排“${item.task.title}”`}
      okText="保存新时间"
      cancelText="取消"
      confirmLoading={saving}
      closable={!saving}
      keyboard={!saving}
      maskClosable={!saving}
      onCancel={onCancel}
      onOk={() => void save()}
    >
      <div className="reschedule-form">
        <Alert
          type="info"
          showIcon
          message="原时间不会被静默移到今天"
          description={`当前安排：${formatSchedule(item.task)}。只有保存后才会修改。`}
        />
        <ScheduleFields
          label="计划"
          value={plannedAt}
          defaultDate={snapshot.today}
          timeZone={snapshot.timeZone}
          onChange={(value) => {
            setSaveError(undefined);
            setPlannedAt(value);
          }}
        />
        <ScheduleFields
          label="截止"
          value={deadlineAt}
          defaultDate={snapshot.today}
          timeZone={snapshot.timeZone}
          onChange={(value) => {
            setSaveError(undefined);
            setDeadlineAt(value);
          }}
        />
        {mixedSameDay ? (
          <Alert
            type="info"
            showIcon
            message="同一天的全天与具体时间可以同时保存"
            description={
              plannedAt.kind === 'allDay'
                ? '全天计划表示当天准备执行，具体截止时间表示当天最晚完成时刻。'
                : '具体计划时间表示当天开始执行，全天截止表示当天结束前完成。'
            }
          />
        ) : null}
        {!validation.ok || saveError !== undefined ? (
          <Alert
            role="alert"
            type="error"
            showIcon
            message={saveError ?? '截止时间不能早于计划时间。'}
          />
        ) : null}
      </div>
    </Modal>
  );
}

interface RecoveryTaskCardProps {
  readonly item: RecoveryTaskView;
  readonly kind: RecoveryKind;
  readonly busy: boolean;
  readonly onAction: (
    item: RecoveryTaskView,
    action: 'complete' | 'skip' | 'reschedule',
  ) => void;
}

function RecoveryTaskCard({ busy, item, kind, onAction }: RecoveryTaskCardProps) {
  return (
    <article className={`recovery-card recovery-${kind}`}>
      <div className="recovery-card-copy">
        <span className="task-state">
          {kind === 'overdue' ? '⚠ 已逾期' : '◷ 计划已错过'}
        </span>
        <Typography.Title level={3}>{item.task.title}</Typography.Title>
        <Typography.Text>{formatSchedule(item.task)}</Typography.Text>
        <Space wrap className="recovery-flags">
          {kind === 'overdue' ? (
            <Tag icon={<WarningOutlined />}>保留原截止时间</Tag>
          ) : null}
          {kind === 'missed' ? (
            <Tag icon={<ClockCircleOutlined />}>保留原计划时间</Tag>
          ) : null}
          {kind === 'overdue' && item.status.missedPlan ? (
            <Tag color="warning">计划也已错过</Tag>
          ) : null}
        </Space>
      </div>
      <Space wrap className="recovery-actions">
        <Button
          icon={<CheckOutlined />}
          disabled={busy}
          aria-label={`完成${item.task.title}`}
          onClick={() => onAction(item, 'complete')}
        >
          完成
        </Button>
        <Button
          icon={<ForwardOutlined />}
          disabled={busy}
          aria-label={`跳过${item.task.title}`}
          onClick={() => onAction(item, 'skip')}
        >
          跳过
        </Button>
        <Button
          type="primary"
          disabled={busy}
          aria-label={`重新安排${item.task.title}`}
          onClick={() => onAction(item, 'reschedule')}
        >
          重新安排
        </Button>
      </Space>
    </article>
  );
}

export function RecoveryPage() {
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const kind: RecoveryKind =
    searchParams.get('kind') === 'overdue' ? 'overdue' : 'missed';
  const [busyTaskId, setBusyTaskId] = useState<string>();
  const [rescheduling, setRescheduling] = useState<RecoveryTaskView>();
  const clockTick = useClockTick();
  const snapshot = useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.recovery.snapshot();
  }, [clockTick]);

  const runAction = async (
    item: RecoveryTaskView,
    action: 'complete' | 'skip' | 'reschedule',
  ) => {
    if (action === 'reschedule') {
      setRescheduling(item);
      return;
    }
    setBusyTaskId(item.task.id);
    try {
      const services = await getApplicationServices();
      if (action === 'complete') await services.recovery.completeTask(item.task.id);
      else await services.recovery.skipTask(item.task.id);
      void message.success(action === 'complete' ? '任务已完成' : '任务已跳过');
    } catch {
      void message.error('操作失败，任务仍保留在原位置，请重试。');
    } finally {
      setBusyTaskId(undefined);
    }
  };

  const items =
    snapshot === undefined
      ? []
      : kind === 'overdue'
        ? snapshot.overdueItems
        : snapshot.missedPlanItems;

  return (
    <section className="feature-page recovery-page">
      <header className="feature-header">
        <div>
          <Typography.Title>恢复</Typography.Title>
          <Typography.Text type="secondary">
            时间会保留原样；由你决定完成、跳过或重新安排。
          </Typography.Text>
        </div>
      </header>
      <nav className="recovery-tabs" aria-label="恢复分组">
        <Link
          className={kind === 'missed' ? 'active' : undefined}
          aria-current={kind === 'missed' ? 'page' : undefined}
          to="/recovery?kind=missed"
        >
          错过计划{snapshot === undefined ? '' : ` ${snapshot.missedPlanItems.length}`}
        </Link>
        <Link
          className={kind === 'overdue' ? 'active' : undefined}
          aria-current={kind === 'overdue' ? 'page' : undefined}
          to="/recovery?kind=overdue"
        >
          已逾期{snapshot === undefined ? '' : ` ${snapshot.overdueItems.length}`}
        </Link>
      </nav>
      {snapshot === undefined ? (
        <div className="feature-loading" role="status">
          <Spin /> 正在加载恢复任务…
        </div>
      ) : items.length === 0 ? (
        <Empty
          description={kind === 'overdue' ? '没有仍逾期的任务' : '没有错过计划的任务'}
        />
      ) : (
        <div className="recovery-list" aria-live="polite">
          {items.map((item) => (
            <RecoveryTaskCard
              key={item.task.id}
              item={item}
              kind={kind}
              busy={busyTaskId === item.task.id}
              onAction={(task, action) => void runAction(task, action)}
            />
          ))}
        </div>
      )}
      {rescheduling !== undefined && snapshot !== undefined ? (
        <RescheduleDialog
          key={rescheduling.task.id}
          item={rescheduling}
          snapshot={snapshot}
          onCancel={() => setRescheduling(undefined)}
          onSaved={() => {
            setRescheduling(undefined);
          }}
        />
      ) : null}
    </section>
  );
}
