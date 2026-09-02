import { Bell, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getApplicationServices } from '@/app/application';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { localTimeSchema, type LocalTime } from '@/domain';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermission,
} from '@/infrastructure/notifications';

import { BackupRestoreCard } from './BackupRestoreCard';

function permissionCopy(permission: BrowserNotificationPermission): string {
  if (permission === 'granted') return '系统通知已允许';
  if (permission === 'denied') return '系统通知已被拒绝，可继续使用应用内提醒';
  if (permission === 'unsupported') return '此浏览器不支持系统通知，可继续使用应用内提醒';
  return '尚未请求系统通知权限';
}

export function SettingsPage() {
  const [defaultTime, setDefaultTime] = useState<LocalTime>();
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getApplicationServices()
      .then(({ reminders }) => reminders.getAllDayDefaultTime())
      .then(setDefaultTime)
      .catch(() => toast.error('读取提醒设置失败，请重试。'));
  }, []);

  const requestPermission = () => {
    const request = requestBrowserNotificationPermission();
    void request
      .then((result) => {
        setPermission(result);
        if (result === 'granted') toast.success('系统通知已启用');
        else toast.info(permissionCopy(result));
      })
      .catch(() => {
        setPermission(getBrowserNotificationPermission());
        toast.error('通知权限请求失败；待办和应用内提醒仍可使用。');
      });
  };

  const saveTime = async () => {
    if (defaultTime === undefined) return;
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.reminders.setAllDayDefaultTime(defaultTime);
      await services.reminderRuntime.reconcile();
      toast.success('全天计划默认提醒时间已保存');
    } catch {
      toast.error('保存失败，原设置保持不变。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="feature-page settings-page">
      <header className="feature-header">
        <div>
          <p className="page-eyebrow">偏好与权限</p>
          <h1>设置</h1>
          <p className="text-muted-foreground">时区、提醒权限与本地数据说明。</p>
        </div>
      </header>
      <div className="settings-grid">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell /> 提醒
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {defaultTime === undefined ? (
              <Spinner aria-label="正在加载提醒设置" />
            ) : (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  全天事项默认提醒时间
                  <Input
                    aria-label="全天计划默认提醒时间"
                    type="time"
                    value={defaultTime}
                    onChange={(event) => {
                      const parsed = localTimeSchema.safeParse(event.target.value);
                      if (parsed.success) setDefaultTime(parsed.data);
                    }}
                  />
                </label>
                <Button disabled={saving} onClick={() => void saveTime()}>
                  {saving ? '正在保存…' : '保存提醒时间'}
                </Button>
                <Alert>
                  <Info />
                  <AlertTitle>{permissionCopy(permission)}</AlertTitle>
                </Alert>
                <Button variant="outline" onClick={requestPermission}>
                  <Bell data-icon="inline-start" />
                  {permission === 'granted' ? '重新检查系统通知' : '启用系统通知'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck /> 浏览器限制
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Alert>
              <TriangleAlert />
              <AlertTitle>关闭后的提醒仅尽力而为</AlertTitle>
              <AlertDescription>
                页面可见且浏览器允许执行时，One Day 会在目标后 60
                秒内提醒。进入受限后台、设备挂起、浏览器或 PWA
                完全关闭后，本地计时器可能暂停；重新打开时只补发过去 15
                分钟内的未送达提醒。
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              拒绝或不支持系统通知不会影响待办、日历和应用内提醒。通知权限只会在你点击启用按钮后请求。
            </p>
          </CardContent>
        </Card>
        <BackupRestoreCard />
      </div>
    </section>
  );
}
