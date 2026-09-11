import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SYSTEM_INBOX_ID } from '@/domain';
import { QuickAdd } from './QuickAdd';
import { useTodoSnapshot } from './useTodoSnapshot';
import { useCurrentLocalDate } from './useCurrentLocalDate';

interface AddTaskOptions {
  readonly className?: string;
  readonly defaultPlannedDate?: string;
  readonly defaultListId?: string;
}

export function AddTaskButton({ className, ...defaults }: AddTaskOptions) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <Plus />
        <span>添加任务</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="task-composer-dialog">
          <DialogHeader>
            <DialogTitle>添加任务</DialogTitle>
            <DialogDescription>
              先记下要做的事，日期和关联信息按需填写。
            </DialogDescription>
          </DialogHeader>
          {open ? <AddTaskForm {...defaults} onCreated={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddTaskForm({
  onCreated,
  defaultListId = SYSTEM_INBOX_ID,
  ...defaults
}: AddTaskOptions & { readonly onCreated: () => void }) {
  const snapshot = useTodoSnapshot();
  const today = useCurrentLocalDate(snapshot?.timeZone);
  return snapshot && today ? (
    <QuickAdd
      defaultListId={defaultListId}
      {...defaults}
      today={today}
      goals={snapshot.goals}
      initiallyExpanded
      onCreated={onCreated}
    />
  ) : (
    <p className="p-6">正在加载…</p>
  );
}
