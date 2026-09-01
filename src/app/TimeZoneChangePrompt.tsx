import { TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { detectDeviceTimeZone, type TimeZoneInspection } from '@/application';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { getApplicationServices } from './application';

export function TimeZoneChangePrompt() {
  const [inspection, setInspection] = useState<TimeZoneInspection>();
  const [saving, setSaving] = useState(false);
  const dismissedDeviceTimeZone = useRef<string | undefined>(undefined);

  const inspect = useCallback(async () => {
    try {
      const services = await getApplicationServices();
      const result =
        await services.timeZoneSettings.inspectDeviceTimeZone(detectDeviceTimeZone());

      if (!result.requiresConfirmation) {
        dismissedDeviceTimeZone.current = undefined;
        setInspection(undefined);
        return;
      }

      if (dismissedDeviceTimeZone.current !== result.deviceTimeZone) {
        setInspection(result);
      }
    } catch {
      toast.error('无法读取应用时区设置，请重新加载后再试。');
    }
  }, []);

  useEffect(() => {
    const inspectFromEvent = () => {
      void inspect();
    };
    queueMicrotask(inspectFromEvent);

    const inspectWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void inspect();
      }
    };

    window.addEventListener('focus', inspectFromEvent);
    window.addEventListener('pageshow', inspectFromEvent);
    document.addEventListener('visibilitychange', inspectWhenVisible);
    return () => {
      window.removeEventListener('focus', inspectFromEvent);
      window.removeEventListener('pageshow', inspectFromEvent);
      document.removeEventListener('visibilitychange', inspectWhenVisible);
    };
  }, [inspect]);

  const confirmChange = async () => {
    if (inspection === undefined) return;

    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.timeZoneSettings.confirmDeviceTimeZone(inspection.deviceTimeZone);
      await services.reminderRuntime.applicationTimeZoneChanged();
      dismissedDeviceTimeZone.current = undefined;
      setInspection(undefined);
      toast.success('应用时区已更新，后续提醒将按新时区重新计算。');
    } catch {
      toast.error('应用时区更新失败，原设置保持不变。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={inspection !== undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>检测到设备时区变化</DialogTitle>
          <DialogDescription>
            One Day 不会因为设备时区变化而静默移动你的计划。
          </DialogDescription>
        </DialogHeader>
        {inspection === undefined ? null : (
          <Alert>
            <TriangleAlert />
            <AlertTitle>计划时间不会自动随设备变化</AlertTitle>
            <AlertDescription>
              当前应用时区为 {inspection.applicationTimeZone}，设备时区为{' '}
              {inspection.deviceTimeZone}
              。只有确认后才会修改应用时区；全天计划日期保持不变。
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (inspection !== undefined) {
                dismissedDeviceTimeZone.current = inspection.deviceTimeZone;
              }
              setInspection(undefined);
            }}
          >
            保持原时区
          </Button>
          <Button disabled={saving} onClick={() => void confirmChange()}>
            {saving ? '正在更新…' : '确认修改应用时区'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
