import { CircleAlert } from 'lucide-react';
import { useNavigate, useRouteError } from 'react-router';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

export function AppErrorPage({ notFound = false }: { readonly notFound?: boolean }) {
  const error = useRouteError();
  const navigate = useNavigate();

  const exportDiagnostics = () => {
    const payload = JSON.stringify(
      {
        occurredAt: new Date().toISOString(),
        errorName: safeErrorName(error),
        databaseVersion: 1,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: 'application/json;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'one-day-diagnostics.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-error-page">
      <Alert variant="destructive" className="max-w-3xl pr-4">
        <CircleAlert />
        <AlertTitle>{notFound ? '页面不存在' : '本地数据暂时无法读取'}</AlertTitle>
        <AlertDescription>
          {notFound
            ? '这个地址没有对应页面，可以安全返回收件箱。'
            : '你的数据没有被自动清空或替换。可以重试、返回收件箱，或导出不含任务内容的诊断信息。'}
        </AlertDescription>
        <AlertAction className="static col-span-full mt-4">
          <div className="flex flex-wrap gap-2">
            {!notFound ? (
              <Button variant="outline" onClick={() => window.location.reload()}>
                重新加载
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate('/inbox')}>
              返回收件箱
            </Button>
            {!notFound ? (
              <Button variant="outline" onClick={exportDiagnostics}>
                导出诊断信息
              </Button>
            ) : null}
          </div>
        </AlertAction>
      </Alert>
    </main>
  );
}
