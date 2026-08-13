import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { decodeLocalDate, decodeSchedulePoint } from '../../src/domain';
import { ScheduleFields } from '../../src/features/todos/ScheduleFields';

describe('ScheduleFields', () => {
  it('emits decoded schedule values from accessible controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const defaultDate = decodeLocalDate('2026-08-13');
    const { rerender } = render(
      <ScheduleFields
        label="计划"
        value={{ kind: 'none' }}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: '计划类型' }),
      'allDay',
    );
    expect(onChange).toHaveBeenCalledWith(
      decodeSchedulePoint({ kind: 'allDay', date: defaultDate }),
    );

    rerender(
      <ScheduleFields
        label="计划"
        value={decodeSchedulePoint({ kind: 'allDay', date: defaultDate })}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('计划日期'), {
      target: { value: '2026-08-14' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' }),
    );
  });

  it('preserves the local date while switching between all-day and exact time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const defaultDate = decodeLocalDate('2026-08-13');
    const { rerender } = render(
      <ScheduleFields
        label="计划"
        value={decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' })}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: '计划类型' }), 'timed');
    expect(onChange).toHaveBeenLastCalledWith(
      decodeSchedulePoint({ kind: 'timed', localDateTime: '2026-08-14T09:00' }),
    );

    rerender(
      <ScheduleFields
        label="计划"
        value={decodeSchedulePoint({
          kind: 'timed',
          localDateTime: '2026-08-14T18:30',
        })}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: '计划类型' }),
      'allDay',
    );
    expect(onChange).toHaveBeenLastCalledWith(
      decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' }),
    );
  });

  it('remembers the last exact time during a kind switch in the same form session', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const defaultDate = decodeLocalDate('2026-08-13');
    const { rerender } = render(
      <ScheduleFields
        label="截止"
        value={decodeSchedulePoint({
          kind: 'timed',
          localDateTime: '2026-08-14T18:30',
        })}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: '截止类型' }),
      'allDay',
    );
    rerender(
      <ScheduleFields
        label="截止"
        value={decodeSchedulePoint({ kind: 'allDay', date: '2026-08-14' })}
        defaultDate={defaultDate}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: '截止类型' }), 'timed');

    expect(onChange).toHaveBeenLastCalledWith(
      decodeSchedulePoint({ kind: 'timed', localDateTime: '2026-08-14T18:30' }),
    );
  });
});
