import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddTaskButton } from '@/features/todos/AddTaskButton';

export function PageActions(defaults: {
  readonly defaultPlannedDate?: string;
  readonly defaultListId?: string;
}) {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  return (
    <div className="page-actions">
      <Button
        variant="outline"
        size="icon"
        aria-label={dark ? '切换浅色模式' : '切换深色模式'}
        onClick={() => {
          document.documentElement.classList.toggle('dark', !dark);
          setDark(!dark);
        }}
      >
        {dark ? <Sun /> : <Moon />}
      </Button>
      <AddTaskButton {...defaults} />
    </div>
  );
}
