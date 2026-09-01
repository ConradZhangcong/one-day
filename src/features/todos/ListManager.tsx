import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  FolderArchive,
  Inbox,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { TaskList } from '@/domain';

interface Props {
  readonly lists: readonly TaskList[];
  readonly open: boolean;
  readonly onClose: () => void;
}

export function ListManager({ lists, onClose, open }: Props) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<TaskList>();
  const [renameValue, setRenameValue] = useState('');
  const [removing, setRemoving] = useState<TaskList>();

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await operation();
      toast.success(success);
    } catch {
      toast.error('操作失败，原数据保持不变。');
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    await run(async () => {
      const services = await getApplicationServices();
      await services.todos.createList(newName);
      setNewName('');
    }, '清单已创建');
  };

  const submitRename = async () => {
    if (renaming === undefined || !renameValue.trim()) return;
    await run(
      async () =>
        (await getApplicationServices()).todos.updateList(renaming.id, {
          name: renameValue,
        }),
      '清单已重命名',
    );
    setRenaming(undefined);
  };

  const remove = async () => {
    if (removing === undefined) return;
    setSaving(true);
    try {
      const result = await (await getApplicationServices()).todos.deleteList(removing.id);
      toast.success(
        `已迁移 ${result.movedSingleTaskCount} 个任务和 ${result.movedRecurrenceSeriesCount} 个系列`,
      );
      setRemoving(undefined);
    } catch {
      toast.error('删除失败，清单和其中任务保持不变。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理清单</DialogTitle>
            <DialogDescription>
              创建、排序或归档一级清单；系统收件箱始终保留。
            </DialogDescription>
          </DialogHeader>
          <form
            className="inline-create"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="新清单名称"
              aria-label="新清单名称"
            />
            <Button type="submit" disabled={saving}>
              <Plus data-icon="inline-start" /> 创建
            </Button>
          </form>
          <div className="divide-y rounded-xl border">
            {[...lists]
              .sort((a, b) => a.order - b.order)
              .map((list) => (
                <article className="flex items-center gap-3 p-3" key={list.id}>
                  <span className="grid size-9 place-items-center rounded-lg bg-muted">
                    <Inbox className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {list.name}
                      {list.isSystem ? <Badge variant="secondary">系统</Badge> : null}
                      {list.archived ? <Badge variant="outline">已归档</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {list.isSystem ? '默认清单，不可删除或归档' : '一级清单'}
                    </p>
                  </div>
                  {!list.isSystem ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`上移${list.name}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (await getApplicationServices()).todos.reorderList(
                                list.id,
                                -1,
                              ),
                            '顺序已更新',
                          )
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`下移${list.name}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (await getApplicationServices()).todos.reorderList(
                                list.id,
                                1,
                              ),
                            '顺序已更新',
                          )
                        }
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`重命名${list.name}`}
                        onClick={() => {
                          setRenameValue(list.name);
                          setRenaming(list);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${list.archived ? '恢复' : '归档'}${list.name}`}
                        onClick={() =>
                          void run(
                            async () =>
                              (await getApplicationServices()).todos.updateList(list.id, {
                                archived: !list.archived,
                              }),
                            list.archived ? '清单已恢复' : '清单已归档',
                          )
                        }
                      >
                        {list.archived ? <ArchiveRestore /> : <FolderArchive />}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`删除${list.name}`}
                        onClick={() => setRemoving(list)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
          </div>
          <p className="text-sm text-muted-foreground">
            归档清单会从导航和新任务选择中隐藏，但保留其中任务。
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renaming !== undefined}
        onOpenChange={(value) => !value && setRenaming(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名清单</DialogTitle>
            <DialogDescription>输入一个便于识别的新名称。</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            aria-label="清单名称"
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(undefined)}>
              取消
            </Button>
            <Button
              disabled={saving || !renameValue.trim()}
              onClick={() => void submitRename()}
            >
              {saving ? '正在保存…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(value) => !value && setRemoving(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{removing?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              其中未删除的单次任务和重复系列模板会安全移动到收件箱。此操作不会删除任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {saving ? '正在迁移…' : '删除并迁移'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
