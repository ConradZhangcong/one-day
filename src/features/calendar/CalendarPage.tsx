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
  agenda: '议程',
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
  if (item.kind === 'deadline' && item.schedule.kind === 'allDay') return '截止';
  return item.schedule.kind === 'allDay' ? '全天' : item.schedule.localDateTime.slice(11);
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
      {item.ownerKind === 'occurrence' ? (
        <Repeat2 className="size-3.5" aria-label="重复实例" />
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
    stateValue === 'completed' || stateValue === 'skipped' || stateValue === 'pending'
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
          <p className="page-eyebrow">时间安排</p>
          <h1>日历</h1>
          <p className="text-muted-foreground">计划是行动位置，截止是最后边界。</p>
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
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-view-switch" aria-label="日历视图">
          {(Object.keys(VIEW_LABEL) as CalendarView[]).map((item) => (
            <Button
              key={item}
              variant={view === item ? 'default' : 'ghost'}
              size="sm"
              onClick={() => switchView(item)}
            >
              {VIEW_LABEL[item]}
            </Button>
          ))}
        </div>
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
        </div>
      </div>
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
                  <Badge variant="secondary">
                    {items.filter((item) => item.kind === 'planned').length}
                  </Badge>
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
          {days.map((day) => {
            const items = itemsFor(day);
            const inMonth = day.month === Temporal.PlainDate.from(anchor).month;
            return (
              <div
                className={`month-day ${inMonth ? '' : 'outside'}`}
                key={day.toString()}
              >
                <button
                  className="month-date"
                  onClick={() => switchView('day', day.toString())}
                >
                  {day.day}
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
