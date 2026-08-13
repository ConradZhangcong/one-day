import { Alert, App, Modal, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { detectDeviceTimeZone, type TimeZoneInspection } from '@/application';

import { getApplicationServices } from './application';

export function TimeZoneChangePrompt() {
  const { message } = App.useApp();
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
      void message.error('无法读取应用时区设置，请重新加载后再试。');
    }
  }, [message]);

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
      void message.success('应用时区已更新，后续提醒将按新时区重新计算。');
    } catch {
      void message.error('应用时区更新失败，原设置保持不变。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={inspection !== undefined}
      title="检测到设备时区变化"
      okText="确认修改应用时区"
      cancelText="保持原时区"
      confirmLoading={saving}
      closable={!saving}
      maskClosable={false}
      onOk={() => void confirmChange()}
      onCancel={() => {
        if (inspection !== undefined) {
          dismissedDeviceTimeZone.current = inspection.deviceTimeZone;
        }
        setInspection(undefined);
      }}
    >
      {inspection === undefined ? null : (
        <Alert
          type="warning"
          showIcon
          message="计划时间不会自动随设备变化"
          description={
            <Typography.Text>
              当前应用时区为 {inspection.applicationTimeZone}，设备时区为{' '}
              {inspection.deviceTimeZone}
              。只有确认后才会修改应用时区；全天计划日期保持不变。
            </Typography.Text>
          }
        />
      )}
    </Modal>
  );
}
