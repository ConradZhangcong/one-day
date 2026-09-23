import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { Subtask } from '../../src/domain';
import { SubtaskEditor } from '../../src/features/todos/SubtaskEditor';
import { cleanSubtasks } from '../../src/features/todos/subtasks';

it('adds with Enter without submitting, edits, checks, removes and drops empty names', async () => {
  const submit = vi.fn();
  function Harness() {
    const [items, setItems] = useState<Subtask[]>([]);
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(cleanSubtasks(items));
        }}
      >
        <SubtaskEditor value={items} onChange={setItems} />
        <button type="submit">保存</button>
      </form>
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: '添加子项' }));
  await user.type(screen.getByRole('textbox', { name: '子项名称 1' }), '第一项{Enter}');
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '子项名称 2' })).toHaveFocus();
  await user.type(screen.getByRole('textbox', { name: '子项名称 2' }), '第二项');
  await user.click(screen.getByRole('checkbox', { name: '完成子项：第二项' }));
  await user.click(screen.getByRole('button', { name: '删除子项 1' }));
  await user.click(screen.getByRole('button', { name: '添加子项' }));
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(submit).toHaveBeenCalledWith([
    { id: expect.any(String) as string, title: '第二项', completed: true },
  ]);
});
