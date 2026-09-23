import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { RecurrenceFields } from '../../src/features/todos/RecurrenceFields';
import { decodeLocalDate, type FixedRecurrenceRule } from '../../src/domain';

function Harness() {
  const [rule, setRule] = useState<FixedRecurrenceRule>({
    frequency: 'daily',
    interval: 1,
  });
  return (
    <RecurrenceFields
      anchor={{ kind: 'allDay', date: decodeLocalDate('2026-09-25') }}
      rule={rule}
      onChange={setRule}
    />
  );
}

it('selects workdays and skips the weekend in the occurrence preview', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.selectOptions(screen.getByLabelText('频率'), 'workdays');
  for (const day of ['一', '二', '三', '四', '五'])
    expect(screen.getByRole('button', { name: `周${day}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  expect(screen.getByRole('button', { name: '周六' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(screen.getByText('2026-09-25')).toBeVisible();
  expect(screen.getByText('2026-09-28')).toBeVisible();
  expect(screen.getByText('2026-09-29')).toBeVisible();
});

it('supports selected weekdays, keeps at least one and preserves the end condition', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.selectOptions(screen.getByLabelText('结束'), 'count');
  await user.selectOptions(screen.getByLabelText('频率'), 'weekly');
  await user.click(screen.getByRole('button', { name: '周一' }));
  expect(screen.getByText('2026-09-28')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '周五' }));
  await user.click(screen.getByRole('button', { name: '周一' }));
  expect(screen.getByRole('button', { name: '周一' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByLabelText('结束')).toHaveValue('count');
  await user.selectOptions(screen.getByLabelText('频率'), 'workdays');
  expect(screen.getByLabelText('结束')).toHaveValue('count');
});
