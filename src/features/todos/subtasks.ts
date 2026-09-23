import type { Subtask } from '@/domain';

export function cleanSubtasks(items: readonly Subtask[]): Subtask[] {
  return items
    .map((item) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title !== '');
}
