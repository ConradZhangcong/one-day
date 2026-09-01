import { CheckCircle2, Clock3, Forward, TriangleAlert } from 'lucide-react';
import { Temporal } from 'temporal-polyfill';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router';

import { getApplicationServices, type ApplicationServices } from '@/app/application';
import { EmptyState, LoadingState } from '@/components/ui/compat';
import { Input } from '@/components/ui/input';
import { localDateSchema, type Instant, type TimeZoneId } from '@/domain';
import { useClockTick } from '@/features/recovery/useClockTick';
import { formatSchedule } from '@/features/todos/task-view';

type ReviewPeriod = 'day' | 'week';
type ReviewSnapshot = Awaited<ReturnType<ApplicationServices['recovery']['review']>>;
type ReviewBucket = ReviewSnapshot['completed'];

const BUCKETS = [
  {
    key: 'completed',
    title: '已完成',
    empty: '这个范围内没有完成记录',
    icon: CheckCircle2,
  },
  { key: 'skipped', title: '已跳过', empty: '这个范围内没有跳过记录', icon: Forward },
  {
    key: 'missedPlan',
    title: '错过计划',
    empty: '这个范围内没有错过计划的任务',
    icon: Clock3,
  },
  {
    key: 'overdue',
    title: '仍逾期',
    empty: '这个范围内没有仍逾期的任务',
    icon: TriangleAlert,
  },
] as const;

function formatLocalActionTime(
  instant: Instant | undefined,
  timeZone: TimeZoneId,
): string {
  if (instant === undefined) return '';
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' })
    .replace('T', ' ');
}

function itemDetail(
  item: ReviewBucket['items'][number],
  key: (typeof BUCKETS)[number]['key'],
  timeZone: TimeZoneId,
): string {
  if (key === 'completed') {
    const time = formatLocalActionTime(item.task.completedAt, timeZone);
    return time ? `完成于 ${time}` : '已完成';
  }
  if (key === 'skipped') {
    const time = formatLocalActionTime(item.task.skippedAt, timeZone);
    return time ? `跳过于 ${time}` : '已跳过';
  }
  return formatSchedule(item.task);
}

function ReviewBucketCard({
  bucket,
  config,
  timeZone,
}: {
  readonly bucket: ReviewBucket;
  readonly config: (typeof BUCKETS)[number];
  readonly timeZone: TimeZoneId;
}) {
  const Icon = config.icon;
  return (
    <article className={`review-bucket review-${config.key}`}>
      <div className="review-stat" aria-label={`${config.title} ${bucket.count} 项`}>
        <span className="review-stat-icon">
          <Icon />
        </span>
        <span>
          <strong>{bucket.count}</strong>
          <small>{config.title}</small>
        </span>
      </div>
      {bucket.items.length === 0 ? (
        <EmptyState description={config.empty} />
      ) : (
        <ul className="review-items">
          {bucket.items.map((item) => (
            <li key={item.task.id}>
              <span className="review-item-status" aria-hidden="true">
                <Icon />
              </span>
              <span>
                <strong>{item.task.title}</strong>
                <small>{itemDetail(item, config.key, timeZone)}</small>
                {config.key === 'overdue' && item.status.missedPlan ? (
                  <small>计划也已错过</small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period: ReviewPeriod = searchParams.get('period') === 'week' ? 'week' : 'day';
  const parsedAnchor = localDateSchema.safeParse(searchParams.get('date'));
  const anchorDate = parsedAnchor.success ? parsedAnchor.data : undefined;
  const clockTick = useClockTick();
  const snapshot = useLiveQuery(async () => {
    const services = await getApplicationServices();
    const input = anchorDate === undefined ? { period } : { period, anchorDate };
    return services.recovery.review(input);
  }, [anchorDate, clockTick, period]);

  const updateDate = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('date', value);
    else next.delete('date');
    setSearchParams(next, { replace: true });
  };
  const rangeCopy =
    snapshot === undefined
      ? ''
      : snapshot.period === 'day'
        ? snapshot.startDate
        : `${snapshot.startDate} 至 ${Temporal.PlainDate.from(snapshot.endDateExclusive).subtract({ days: 1 }).toString()}（周一开周）`;

  return (
    <section className="feature-page review-page">
      <header className="feature-header">
        <div>
          <p className="page-eyebrow">完成记录</p>
          <h1>回顾</h1>
          <p className="text-muted-foreground">
            只读查看完成、跳过和仍需恢复的事项，不会修改任务。
          </p>
        </div>
      </header>
      <div className="review-controls">
        <nav className="recovery-tabs" aria-label="回顾范围">
          <Link
            className={period === 'day' ? 'active' : undefined}
            aria-current={period === 'day' ? 'page' : undefined}
            to={`?period=day${anchorDate === undefined ? '' : `&date=${anchorDate}`}`}
          >
            日回顾
          </Link>
          <Link
            className={period === 'week' ? 'active' : undefined}
            aria-current={period === 'week' ? 'page' : undefined}
            to={`?period=week${anchorDate === undefined ? '' : `&date=${anchorDate}`}`}
          >
            周回顾
          </Link>
        </nav>
        <label className="review-date-control">
          选择日期
          <Input
            aria-label="回顾日期"
            type="date"
            value={anchorDate ?? ''}
            onChange={(event) => updateDate(event.target.value)}
          />
        </label>
      </div>
      {rangeCopy ? <p className="review-range">回顾范围：{rangeCopy}</p> : null}
      {snapshot === undefined ? (
        <LoadingState label="正在整理回顾…" />
      ) : (
        <div className="review-grid" aria-live="polite">
          {BUCKETS.map((config) => (
            <ReviewBucketCard
              key={config.key}
              config={config}
              bucket={snapshot[config.key]}
              timeZone={snapshot.timeZone}
            />
          ))}
        </div>
      )}
    </section>
  );
}
