import {
  DatabaseBackup,
  Download,
  FileJson,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import type { BackupInspection, BackupSummary } from '@/application';
import {
  DomainErrorCode,
  isDomainError,
  type DomainError,
  type OneDayBackupV1,
} from '@/domain';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function backupErrorMessage(error: unknown): string {
  if (!isDomainError(error)) return '备份操作失败，请重试。原有数据保持不变。';
  const messages: Partial<Record<DomainError['code'], string>> = {
    [DomainErrorCode.BACKUP_INVALID_JSON]: '文件不是有效的 JSON。',
    [DomainErrorCode.BACKUP_INVALID_FORMAT]: '这不是 One Day 备份文件。',
    [DomainErrorCode.BACKUP_UNSUPPORTED_VERSION]: '此备份版本暂不受支持。',
    [DomainErrorCode.BACKUP_INVALID_DATA]: '备份内容损坏或引用不完整，未修改当前数据。',
  };
  return messages[error.code] ?? '备份内容无效，未修改当前数据。';
}

function backupFilename(exportedAt: OneDayBackupV1['exportedAt']): string {
  return `one-day-backup-${exportedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`;
}

function downloadBackup(backup: OneDayBackupV1): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFilename(backup.exportedAt);
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Summary({ summary }: { readonly summary: BackupSummary }) {
  const counts = summary.counts;
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <FileJson className="size-4" aria-hidden />
        备份摘要
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">普通任务</dt>
          <dd>{counts.singleTasks}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">重复系列</dt>
          <dd>{counts.recurrenceSeries}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">发生记录</dt>
          <dd>{counts.occurrenceRecords}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">清单</dt>
          <dd>{counts.lists}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">标签</dt>
          <dd>{counts.tags}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">提醒</dt>
          <dd>{counts.reminders}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">长期目标</dt>
          <dd>{counts.longTermGoals}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">应用时区</dt>
          <dd>{summary.timeZone}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">导出时间：{summary.exportedAt}</p>
    </div>
  );
}

export function BackupRestoreCard() {
  const [inspection, setInspection] = useState<BackupInspection>();
  const [fileName, setFileName] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const busy = exporting || inspecting || restoring || clearing;

  const exportData = async () => {
    setExporting(true);
    try {
      const services = await getApplicationServices();
      const backup = await services.backup.createExport();
      downloadBackup(backup);
      toast.success('备份文件已生成，请妥善保存。');
    } catch (error) {
      toast.error(backupErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const inspectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined) return;
    setInspecting(true);
    setInspection(undefined);
    setFileName(file.name);
    try {
      const services = await getApplicationServices();
      const result = services.backup.inspect(await file.text());
      setInspection(result);
    } catch (error) {
      setFileName(undefined);
      toast.error(backupErrorMessage(error));
    } finally {
      setInspecting(false);
    }
  };

  const clearInspection = () => {
    setInspection(undefined);
    setFileName(undefined);
    setRestoreConfirmOpen(false);
  };

  const restoreData = async () => {
    if (inspection === undefined) return;
    setRestoring(true);
    try {
      const services = await getApplicationServices();
      await services.backup.restore(inspection);
      clearInspection();
      toast.success('备份已恢复，页面数据和提醒已重新加载。');
    } catch (error) {
      setRestoreConfirmOpen(false);
      toast.error(backupErrorMessage(error));
    } finally {
      setRestoring(false);
    }
  };

  const clearLocalData = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const services = await getApplicationServices();
      await services.backup.clearLocalData();
      setInspection(undefined);
      setFileName(undefined);
      setRestoreConfirmOpen(false);
      setClearConfirmOpen(false);
      toast.success('本地数据已清空，One Day 已恢复为全新状态。');
    } catch {
      setClearConfirmOpen(false);
      toast.error('清空失败，原数据保持不变。');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup /> 本地数据
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Alert>
          <TriangleAlert />
          <AlertTitle>备份文件包含你的个人内容</AlertTitle>
          <AlertDescription>
            文件可能包含任务标题、备注、标签、时间和历史记录。One Day
            不会上传备份，请把文件保存在可信位置。
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="grid content-start gap-3 rounded-lg border p-4">
            <div>
              <h2 className="font-medium">导出完整备份</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                下载版本化 JSON，包含当前设备上的全部可恢复数据。
              </p>
            </div>
            <Button disabled={busy} onClick={() => void exportData()}>
              <Download data-icon="inline-start" />
              {exporting ? '正在生成…' : '导出备份'}
            </Button>
          </section>

          <section className="grid content-start gap-3 rounded-lg border p-4">
            <div>
              <h2 className="font-medium">从备份恢复</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                先检查文件并显示摘要，确认后才会替换当前数据。
              </p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              选择 One Day JSON 备份
              <Input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(event) => void inspectFile(event)}
              />
            </label>
            {inspecting ? (
              <p className="text-sm text-muted-foreground">正在检查备份…</p>
            ) : null}
          </section>
        </div>

        {inspection === undefined ? null : (
          <div className="grid gap-3">
            <p className="text-sm">
              已检查文件：<span className="font-medium">{fileName}</span>
            </p>
            <Summary summary={inspection.summary} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={busy} onClick={clearInspection}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setRestoreConfirmOpen(true)}
              >
                <Upload data-icon="inline-start" />
                恢复此备份
              </Button>
            </div>
          </div>
        )}

        <section className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 text-destructive" aria-hidden />
            <div>
              <h2 className="font-medium text-destructive">危险操作</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                清空会永久删除此设备上的任务、重复系列、历史、清单、标签、提醒、长期目标和应用偏好，且无法撤销。
              </p>
              <p className="mt-2 text-sm font-medium">建议先导出完整备份并妥善保存。</p>
            </div>
          </div>
          <div>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => setClearConfirmOpen(true)}
            >
              <Trash2 data-icon="inline-start" />
              清空本地数据
            </Button>
          </div>
        </section>
      </CardContent>

      <AlertDialog
        open={restoreConfirmOpen}
        onOpenChange={(open) => {
          if (!restoring) setRestoreConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>替换当前设备上的全部数据？</AlertDialogTitle>
            <AlertDialogDescription>
              当前 One Day
              数据将被所选备份完整替换，操作无法撤销。若恢复失败，原数据会保持不变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>返回检查</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={restoring}
              onClick={() => void restoreData()}
            >
              {restoring ? '正在恢复…' : '确认替换并恢复'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clearConfirmOpen}
        onOpenChange={(open) => {
          if (!clearing) setClearConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlert aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>确认清空此设备上的全部数据？</AlertDialogTitle>
            <AlertDialogDescription>
              所有任务、重复系列、历史、清单、标签、提醒、长期目标和应用偏好都将永久删除。浏览器通知权限不会改变。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>取消，保留数据</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearing}
              onClick={() => void clearLocalData()}
            >
              {clearing ? '正在清空…' : '确认清空全部数据'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
