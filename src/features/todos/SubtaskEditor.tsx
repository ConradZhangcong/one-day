import { Plus, X } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Subtask } from '@/domain';

import { cleanSubtasks } from './subtasks';

export function SubtaskEditor({
  value,
  onChange,
  onCommit,
  disabled = false,
  readOnly = false,
  templateMode = false,
}: {
  readonly value: readonly Subtask[];
  readonly onChange: (items: Subtask[]) => void;
  readonly onCommit?: (items: Subtask[]) => void;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly templateMode?: boolean;
}) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const visible = cleanSubtasks(value);
  const add = () => {
    const empty = value.find((item) => !item.title.trim());
    if (empty) {
      inputs.current.get(empty.id)?.focus();
      return;
    }
    onChange([...value, { id: crypto.randomUUID(), title: '', completed: false }]);
  };
  return (
    <section className="subtask-editor" aria-label="子任务">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm">子任务</strong>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {templateMode
            ? `${visible.length} 项`
            : `${visible.filter((item) => item.completed).length}/${visible.length}`}
        </span>
      </div>
      {value.map((item, index) => (
        <div className="subtask-editor-row" key={item.id}>
          <input
            type="checkbox"
            aria-label={`完成子项：${item.title || `第 ${index + 1} 项`}`}
            checked={!templateMode && item.completed}
            disabled={disabled || readOnly || templateMode}
            onChange={(event) => {
              const next = value.map((entry) =>
                entry.id === item.id
                  ? { ...entry, completed: event.target.checked }
                  : entry,
              );
              onChange(next);
              onCommit?.(next);
            }}
          />
          {readOnly ? (
            <span
              className={
                !templateMode && item.completed
                  ? 'line-through text-muted-foreground'
                  : ''
              }
            >
              {item.title}
            </span>
          ) : (
            <Input
              ref={(node) => {
                if (node) inputs.current.set(item.id, node);
                else inputs.current.delete(item.id);
              }}
              autoFocus={!item.title}
              aria-label={`子项名称 ${index + 1}`}
              placeholder="输入子项，按 Enter 继续"
              value={item.title}
              disabled={disabled}
              className={
                !templateMode && item.completed
                  ? 'line-through text-muted-foreground'
                  : ''
              }
              onChange={(event) =>
                onChange(
                  value.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, title: event.target.value }
                      : entry,
                  ),
                )
              }
              onBlur={() => onCommit?.([...value])}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  onCommit?.([...value]);
                  add();
                }
              }}
            />
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`删除子项 ${index + 1}`}
              onClick={() => {
                const remaining = value.filter((entry) => entry.id !== item.id);
                onChange(remaining);
                onCommit?.(remaining);
                const next = value[index + 1] ?? value[index - 1];
                if (next) inputs.current.get(next.id)?.focus();
                else addButton.current?.focus();
              }}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <>
          <Button
            ref={addButton}
            type="button"
            variant="ghost"
            className="justify-start"
            disabled={disabled}
            onClick={add}
          >
            <Plus className="size-4" /> 添加子项
          </Button>
          <p className="text-xs text-muted-foreground">
            {templateMode
              ? '每次重复均从未完成开始，子项没有独立时间。'
              : '子项没有独立时间，全部勾选后仍需手动完成任务。'}
          </p>
        </>
      )}
      {readOnly && value.length === 0 && (
        <p className="text-xs text-muted-foreground">暂无子项</p>
      )}
    </section>
  );
}
