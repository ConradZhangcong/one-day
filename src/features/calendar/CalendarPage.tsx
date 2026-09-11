import { PageActions } from '@/app/PageActions';
import { ChevronLeft, ChevronRight, Repeat2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Temporal } from 'temporal-polyfill';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { getApplicationServices } from '@/app/application';
import { useApplicationRevision } from '@/app/application-change';
import type { CalendarItemView } from '@/application';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, SimpleSelect } from '@/components/ui/compat';
import { Skeleton } from '@/components/ui/skeleton';
import {
  decodeLocalDate,
  prioritySchema,
  schedulePointLocalDate,
  type LocalDate,
} from '@/domain';
import { TaskDetailsDrawer } from '@/features/todos/TaskDetailsDrawer';
import { OccurrenceDetailsDrawer } from '@/features/todos/OccurrenceDetailsDrawer';
import { useTodoSnapshot } from '@/features/todos/useTodoSnapshot';

type CalendarView = 'agenda' | 'day' | 'week' | 'month';
const VIEW_LABEL: Record<CalendarView, string> = {
  agenda: '日程',
  day: '日',
  week: '周',
  month: '月',
};
const WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'] as const;

function parseView(value: string | undefined): CalendarView {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'agenda';
}

function localDate(value: Temporal.PlainDate): LocalDate {
  return decodeLocalDate(value.toString());
}

function rangeFor(view: CalendarView, anchor: LocalDate) {
  const value = Temporal.PlainDate.from(anchor);
  if (view === 'day') return { start: value, end: value.add({ days: 1 }), step: 1 };
  if (view === 'week') {
    const start = value.subtract({ days: value.dayOfWeek - 1 });
    return { start, end: start.add({ days: 7 }), step: 7 };
  }
  if (view === 'month') {
    const first = value.with({ day: 1 });
    const start = first.subtract({ days: first.dayOfWeek - 1 });
    return { start, end: start.add({ days: 42 }), step: 1 };
  }
  return { start: value, end: value.add({ days: 14 }), step: 14 };
}

function itemTime(item: CalendarItemView): string {
  const time =
    item.schedule.kind === 'allDay' ? '全天' : item.schedule.localDateTime.slice(11);
  return `${item.kind === 'deadline' ? '截止 ' : ''}${time}`;
}

function CalendarItem({
  item,
  onOpen,
}: {
  readonly item: CalendarItemView;
  readonly onOpen: () => void;
}) {
  return (
    <button className={`calendar-item kind-${item.kind}`} onClick={onOpen}>
      <span className="calendar-item-time">{itemTime(item)}</span>
      <strong>{item.title}</strong>
      {item.kind === 'planned' && item.deadlineAt && item.deadlineAt.kind !== 'none' ? (
        <small>
          截止{' '}
          {item.deadlineAt.kind === 'allDay'
            ? item.deadlineAt.date
            : item.deadlineAt.localDateTime.replace('T', ' ')}
        </small>
      ) : null}
      {item.ownerKind === 'occurrence' ? (
        <Repeat2 className="size-3.5" aria-label="重复事项" />
      ) : null}
    </button>
  );
}

function datesBetween(start: Temporal.PlainDate, end: Temporal.PlainDate) {
  const result: Temporal.PlainDate[] = [];
  for (
    let current = start;
    Temporal.PlainDate.compare(current, end) < 0;
    current = current.add({ days: 1 })
  )
    result.push(current);
  return result;
}

export function CalendarPage() {
  const applicationRevision = useApplicationRevision();
  const { view: routeView } = useParams();
  const view = parseView(routeView);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const todoSnapshot = useTodoSnapshot();
  const today = useMemo(() => {
    const zone =
      todoSnapshot?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return localDate(Temporal.Now.zonedDateTimeISO(zone).toPlainDate());
  }, [todoSnapshot?.timeZone]);
  let anchor = today;
  try {
    anchor = decodeLocalDate(searchParams.get('anchor') ?? today);
  } catch {
    anchor = today;
  }
  const range = rangeFor(view, anchor);
  const rangeStart = localDate(range.start);
  const rangeEnd = localDate(range.end);
  const listId = searchParams.get('list') ?? undefined;
  const priorityValue = searchParams.get('priority');
  const parsedPriority = prioritySchema.safeParse(priorityValue);
  const priority = parsedPriority.success ? parsedPriority.data : undefined;
  const stateValue = searchParams.get('state');
  const state =
    stateValue === 'all' ||
    stateValue === 'completed' ||
    stateValue === 'skipped' ||
    stateValue === 'pending'
      ? stateValue
      : undefined;
  const calendar = useLiveQuery(
    async () =>
      (await getApplicationServices()).calendar.query({
        rangeStart,
        rangeEnd,
        ...(listId ? { listId } : {}),
        ...(priority ? { priority } : {}),
        ...(state ? { state } : {}),
      }),
    [applicationRevision, rangeStart, rangeEnd, listId, priority, state],
  );
  const [opened, setOpened] = useState<CalendarItemView>();
  const openedSeries = todoSnapshot?.series.find((item) => item.id === opened?.seriesId);
  const days = datesBetween(range.start, range.end);

  const setQuery = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const move = (direction: -1 | 1) => {
    const source = Temporal.PlainDate.from(anchor);
    const next =
      view === 'month'
        ? source.add({ months: direction })
        : source.add({ days: range.step * direction });
    setQuery('anchor', next.toString());
  };
  const switchView = (nextView: CalendarView, nextAnchor?: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextAnchor) next.set('anchor', nextAnchor);
    void navigate(`/calendar/${nextView}?${next.toString()}`);
  };
  const itemsFor = (day: Temporal.PlainDate) =>
    (calendar?.items ?? []).filter(
      (item) => schedulePointLocalDate(item.schedule) === day.toString(),
    );

  return (
    <section className="calendar-page">
      <header className="calendar-header">
        <div>
          <h1>日历</h1>
          <p className="text-sm text-muted-foreground">
            {range.start.toString()} — {range.end.subtract({ days: 1 }).toString()}
          </p>
        </div>
        <div className="calendar-actions">
          <Button
            variant="outline"
            size="icon"
            aria-label="上一范围"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setQuery('anchor', today)}>
            今天
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="下一范围"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <PageActions defaultPlannedDate={anchor} />
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-view-switch" aria-label="日历视图">
          {(Object.keys(VIEW_LABEL) as CalendarView[]).map((item) => (
            <Button
              key={item}
              aria-pressed={view === item}
              variant={view === item ? 'default' : 'ghost'}
              size="sm"
              onClick={() => switchView(item)}
            >
              {VIEW_LABEL[item]}
            </Button>
          ))}
        </div>
        <details className="filter-panel">
          <summary>筛选{listId || priority || state ? ' · 已启用' : ''}</summary>
          <div className="calendar-filters">
            <SimpleSelect
              allowClear
              ariaLabel="日历清单筛选"
              placeholder="全部清单"
              value={listId}
              options={(todoSnapshot?.lists ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(value) =>
                setQuery('list', typeof value === 'string' ? value : undefined)
              }
            />
            <SimpleSelect
              allowClear
              ariaLabel="日历优先级筛选"
              placeholder="全部优先级"
              value={priority}
              options={[
                { value: 'none', label: '无优先级' },
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
              ]}
              onChange={(value) =>
                setQuery('priority', typeof value === 'string' ? value : undefined)
              }
            />
            <SimpleSelect
              ariaLabel="日历状态筛选"
              value={state ?? 'pending'}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待处理' },
                { value: 'completed', label: '已完成' },
                { value: 'skipped', label: '已跳过' },
              ]}
              onChange={(value) =>
                setQuery(
                  'state',
                  typeof value === 'string' && value !== 'pending' ? value : undefined,
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                ['list', 'priority', 'state'].forEach((key) => next.delete(key));
                setSearchParams(next, { replace: true });
              }}
            >
              清除全部筛选
            </Button>
          </div>
        </details>
      </div>
      <Button variant="ghost" onClick={() => navigate('/recovery')}>
        查看待恢复事项
      </Button>
      {calendar === undefined || todoSnapshot === undefined ? (
        <Skeleton className="h-[480px] w-full" />
      ) : calendar.items.length === 0 && view === 'agenda' ? (
        <EmptyState description="这个时间范围内没有符合筛选条件的事项" />
      ) : view === 'agenda' ? (
        <div className="agenda-list">
          {days.map((day) => {
            const items = itemsFor(day);
            if (items.length === 0) return null;
            return (
              <Card key={day.toString()}>
                <CardContent className="agenda-day">
                  <div className="agenda-date">
                    <strong>
                      {day.month}月{day.day}日
                    </strong>
                    <span>周{WEEKDAY[day.dayOfWeek - 1]}</span>
                  </div>
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <CalendarItem
                        key={item.key}
                        item={item}
                        onOpen={() => setOpened(item)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : view === 'day' ? (
        <div className="day-calendar">
          <h2>{range.start.toString()}</h2>
          <p className="text-sm text-muted-foreground">按时间排序，不代表持续时长</p>
          {itemsFor(range.start).length === 0 ? (
            <EmptyState description="这一天没有安排" />
          ) : null}
          {itemsFor(range.start).map((item) => (
            <CalendarItem key={item.key} item={item} onOpen={() => setOpened(item)} />
          ))}
        </div>
      ) : view === 'week' ? (
        <div className="week-calendar">
          {days.map((day) => {
            const items = itemsFor(day);
            return (
              <div className="week-day" key={day.toString()}>
                <header>
                  <span>周{WEEKDAY[day.dayOfWeek - 1]}</span>
                  <strong>{day.day}</strong>
                  <Badge variant="secondary">{items.length}</Badge>
                </header>
                <div>
                  {items.map((item) => (
                    <CalendarItem
                      key={item.key}
                      item={item}
                      onOpen={() => setOpened(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="month-calendar">
          {WEEKDAY.map((label) => (
            <div className="month-weekday" key={label}>
              周{label}
            </div>
          ))}
          {days.map((day) => {
            const items = itemsFor(day);
            const inMonth = day.month === Temporal.PlainDate.from(anchor).month;
            return (
              <div
                className={`month-day ${inMonth ? '' : 'outside'}`}
                key={day.toString()}
              >
                <button
                  aria-label={day.toString()}
                  aria-current={day.toString() === today ? 'date' : undefined}
                  className="month-date"
                  onClick={() => switchView('day', day.toString())}
                >
                  {day.day}
                </button>
                <button
                  className="month-mobile-count"
                  onClick={() => switchView('day', day.toString())}
                  aria-label={`${day.toString()}，${items.length}项`}
                >
                  {items.length ? `${items.length}项` : '—'}
                </button>
                {items.slice(0, 3).map((item) => (
                  <CalendarItem
                    key={item.key}
                    item={item}
                    onOpen={() => setOpened(item)}
                  />
                ))}
                {items.length > 3 ? (
                  <button
                    className="month-more"
                    onClick={() => switchView('day', day.toString())}
                  >
                    +{items.length - 3}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {opened?.ownerKind === 'task' && todoSnapshot
        ? (() => {
            const task = todoSnapshot.tasks.find((item) => item.id === opened.ownerId);
            return task ? (
              <TaskDetailsDrawer
                task={task}
                snapshot={todoSnapshot}
                onClose={() => setOpened(undefined)}
              />
            ) : null;
          })()
        : null}
      {opened?.ownerKind === 'occurrence' ? (
        <OccurrenceDetailsDrawer
          item={opened}
          {...(openedSeries !== undefined ? { series: openedSeries } : {})}
          {...(todoSnapshot !== undefined ? { snapshot: todoSnapshot } : {})}
          onClose={() => setOpened(undefined)}
        />
      ) : null}
    </section>
  );
}
