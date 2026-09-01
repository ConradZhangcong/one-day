import { Temporal } from 'temporal-polyfill';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  projectOccurrenceRange,
  localDateSchema,
  type FixedRecurrenceRule,
  type ScheduledPoint,
} from '@/domain';

interface RecurrenceFieldsProps {
  readonly anchor: ScheduledPoint;
  readonly rule: FixedRecurrenceRule;
  readonly onChange: (rule: FixedRecurrenceRule) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const;

function recurrenceFrequency(value: string): FixedRecurrenceRule['frequency'] {
  switch (value) {
    case 'weekly':
    case 'monthly':
    case 'yearly':
      return value;
    default:
      return 'daily';
  }
}

export function RecurrenceFields({ anchor, rule, onChange }: RecurrenceFieldsProps) {
  const anchorDate =
    anchor.kind === 'allDay'
      ? anchor.date
      : localDateSchema.parse(anchor.localDateTime.slice(0, 10));
  const preview = useMemo(() => {
    try {
      return projectOccurrenceRange({
        seriesId: 'preview',
        revision: 1,
        anchor,
        rule,
        limit: 3,
      });
    } catch {
      return [];
    }
  }, [anchor, rule]);

  const setFrequency = (frequency: FixedRecurrenceRule['frequency']) => {
    const end = rule.end ?? { kind: 'never' as const };
    if (frequency === 'weekly') {
      const weekday = Temporal.PlainDate.from(anchorDate).dayOfWeek;
      onChange({ frequency, interval: rule.interval, weekdays: [weekday], end });
    } else if (frequency === 'monthly') {
      onChange({ frequency, interval: rule.interval, monthMode: 'sameDay', end });
    } else onChange({ frequency, interval: rule.interval, end });
  };

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">固定重复</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1">
          <Label htmlFor="recurrence-frequency">频率</Label>
          <NativeSelect
            id="recurrence-frequency"
            value={rule.frequency}
            onChange={(event) => setFrequency(recurrenceFrequency(event.target.value))}
          >
            <NativeSelectOption value="daily">每天</NativeSelectOption>
            <NativeSelectOption value="weekly">每周</NativeSelectOption>
            <NativeSelectOption value="monthly">每月</NativeSelectOption>
            <NativeSelectOption value="yearly">每年</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="recurrence-interval">间隔</Label>
          <Input
            id="recurrence-interval"
            type="number"
            min={1}
            max={999}
            value={rule.interval}
            onChange={(event) =>
              onChange({
                ...rule,
                interval: Math.max(1, Number(event.target.value) || 1),
              })
            }
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="recurrence-end">结束</Label>
          <NativeSelect
            id="recurrence-end"
            value={rule.end?.kind ?? 'never'}
            onChange={(event) => {
              const kind = event.target.value;
              if (kind === 'date') {
                onChange({ ...rule, end: { kind, inclusive: anchorDate } });
              } else if (kind === 'count')
                onChange({ ...rule, end: { kind, count: 10 } });
              else onChange({ ...rule, end: { kind: 'never' } });
            }}
          >
            <NativeSelectOption value="never">永久</NativeSelectOption>
            <NativeSelectOption value="date">结束日期</NativeSelectOption>
            <NativeSelectOption value="count">发生次数</NativeSelectOption>
          </NativeSelect>
        </div>
        {rule.end?.kind === 'date' ? (
          <div className="grid gap-1">
            <Label htmlFor="recurrence-end-date">包含当天</Label>
            <Input
              id="recurrence-end-date"
              type="date"
              value={rule.end.inclusive}
              onChange={(event) =>
                event.target.value &&
                onChange({
                  ...rule,
                  end: {
                    kind: 'date',
                    inclusive: localDateSchema.parse(event.target.value),
                  },
                })
              }
            />
          </div>
        ) : rule.end?.kind === 'count' ? (
          <div className="grid gap-1">
            <Label htmlFor="recurrence-count">总次数</Label>
            <Input
              id="recurrence-count"
              type="number"
              min={1}
              value={rule.end.count}
              onChange={(event) =>
                onChange({
                  ...rule,
                  end: {
                    kind: 'count',
                    count: Math.max(1, Number(event.target.value) || 1),
                  },
                })
              }
            />
          </div>
        ) : null}
      </div>
      {rule.frequency === 'weekly' ? (
        <div className="flex flex-wrap gap-1" aria-label="每周重复日期">
          {WEEKDAYS.map((label, index) => {
            const weekday = index + 1;
            const selected = rule.weekdays.includes(weekday);
            return (
              <Button
                key={weekday}
                type="button"
                size="sm"
                variant={selected ? 'default' : 'outline'}
                aria-pressed={selected}
                onClick={() => {
                  const weekdays = selected
                    ? rule.weekdays.filter((item) => item !== weekday)
                    : [...rule.weekdays, weekday].sort();
                  if (weekdays.length > 0) onChange({ ...rule, weekdays });
                }}
              >
                周{label}
              </Button>
            );
          })}
        </div>
      ) : null}
      {rule.frequency === 'monthly' ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={rule.monthMode === 'sameDay' ? 'default' : 'outline'}
            onClick={() => onChange({ ...rule, monthMode: 'sameDay' })}
          >
            固定日期
          </Button>
          <Button
            type="button"
            size="sm"
            variant={rule.monthMode === 'lastDay' ? 'default' : 'outline'}
            onClick={() => onChange({ ...rule, monthMode: 'lastDay' })}
          >
            每月最后一天
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="text-sm text-muted-foreground">未来预览</span>
        {preview.map((item) => (
          <Badge key={item.occurrenceKey} variant="secondary">
            {item.originalAnchor.kind === 'allDay'
              ? item.originalAnchor.date
              : item.originalAnchor.localDateTime.replace('T', ' ')}
          </Badge>
        ))}
        {preview.length === 0 ? (
          <span className="text-sm text-destructive">当前规则没有合法发生时间</span>
        ) : null}
      </div>
    </fieldset>
  );
}
