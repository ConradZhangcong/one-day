import { useEffect, useRef } from 'react';

import {
  decodeSchedulePoint,
  interpretSchedulePoint,
  type LocalDate,
  type SchedulePoint,
  type TimeZoneId,
} from '@/domain';

interface Props {
  readonly label: string;
  readonly value: SchedulePoint;
  readonly defaultDate: LocalDate;
  readonly timeZone?: TimeZoneId;
  readonly onChange: (value: SchedulePoint) => void;
}

function pointValue(point: SchedulePoint): string {
  if (point.kind === 'allDay') return point.date;
  if (point.kind === 'timed') return point.localDateTime;
  return '';
}

export function ScheduleFields({ defaultDate, label, value, onChange, timeZone }: Props) {
  const kind = value.kind;
  const lastTimedValue = useRef(
    value.kind === 'timed' ? value.localDateTime.slice(11) : '09:00',
  );

  useEffect(() => {
    if (value.kind === 'timed') {
      lastTimedValue.current = value.localDateTime.slice(11);
    }
  }, [value]);
  const interpretation =
    timeZone === undefined ? undefined : interpretSchedulePoint(value, timeZone);

  return (
    <div className="schedule-field">
      <label>{label}</label>
      <select
        aria-label={`${label}类型`}
        value={kind}
        onChange={(event) => {
          const next = event.target.value;
          if (next === 'none') onChange({ kind: 'none' });
          else if (next === 'allDay') {
            const date =
              value.kind === 'timed'
                ? value.localDateTime.slice(0, 10)
                : value.kind === 'allDay'
                  ? value.date
                  : defaultDate;
            onChange(decodeSchedulePoint({ kind: 'allDay', date }));
          } else {
            const date =
              value.kind === 'allDay'
                ? value.date
                : value.kind === 'timed'
                  ? value.localDateTime.slice(0, 10)
                  : defaultDate;
            onChange(
              decodeSchedulePoint({
                kind: 'timed',
                localDateTime: `${date}T${lastTimedValue.current}`,
              }),
            );
          }
        }}
      >
        <option value="none">不设置</option>
        <option value="allDay">全天计划</option>
        <option value="timed">具体时间</option>
      </select>
      {kind === 'allDay' ? (
        <input
          aria-label={`${label}日期`}
          type="date"
          value={pointValue(value)}
          onChange={(event) => {
            if (event.target.value)
              onChange(decodeSchedulePoint({ kind, date: event.target.value }));
          }}
        />
      ) : null}
      {kind === 'timed' ? (
        <input
          aria-label={`${label}时间`}
          type="datetime-local"
          value={pointValue(value)}
          onChange={(event) => {
            if (event.target.value) {
              lastTimedValue.current = event.target.value.slice(11);
              onChange(decodeSchedulePoint({ kind, localDateTime: event.target.value }));
            }
          }}
        />
      ) : null}
      {interpretation?.kind === 'timed' && interpretation.adjusted ? (
        <span className="schedule-warning" role="alert">
          该本地时间因夏令时不存在，保存后将解释为 {interpretation.resolvedLocalDateTime}
          。
        </span>
      ) : null}
    </div>
  );
}
