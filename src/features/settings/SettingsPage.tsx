import { BellOutlined, SafetyOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { getApplicationServices } from '@/app/application';
import { localTimeSchema, type LocalTime } from '@/domain';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermission,
} from '@/infrastructure/notifications';

function permissionCopy(permission: BrowserNotificationPermission): string {
  if (permission === 'granted') return '系统通知已允许';
  if (permission === 'denied') return '系统通知已被拒绝，可继续使用应用内提醒';
  if (permission === 'unsupported') return '此浏览器不支持系统通知，可继续使用应用内提醒';
  return '尚未请求系统通知权限';
}

export function SettingsPage() {
  const { message } = App.useApp();
  const [defaultTime, setDefaultTime] = useState<LocalTime>();
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getApplicationServices()
      .then(({ reminders }) => reminders.getAllDayDefaultTime())
      .then(setDefaultTime)
      .catch(() => void message.error('读取提醒设置失败，请重试。'));
  }, [message]);

  const requestPermission = () => {
    // The browser API is invoked synchronously in this click handler, before any await.
    const request = requestBrowserNotificationPermission();
    void request
      .then((result) => {
        setPermission(result);
        if (result === 'granted') void message.success('系统通知已启用');
        else void message.info(permissionCopy(result));
      })
      .catch(() => {
        setPermission(getBrowserNotificationPermission());
        void message.error('通知权限请求失败；待办和应用内提醒仍可使用。');
      });
  };

  const saveTime = async () => {
    if (defaultTime === undefined) return;
    setSaving(true);
    try {
      const services = await getApplicationServices();
      await services.reminders.setAllDayDefaultTime(defaultTime);
      await services.reminderRuntime.reconcile();
      void message.success('全天计划默认提醒时间已保存');
    } catch {
      void message.error('保存失败，原设置保持不变。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="feature-page settings-page">
      <header className="feature-header">
        <div>
          <Typography.Title>设置</Typography.Title>
          <Typography.Text type="secondary">
            时区、提醒权限与本地数据说明。
          </Typography.Text>
        </div>
      </header>
      <div className="settings-grid">
        <Card
          title={
            <>
              <BellOutlined /> 提醒
            </>
          }
        >
          {defaultTime === undefined ? (
            <Spin />
          ) : (
            <Space direction="vertical" size="middle">
              <label>
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
              <Button type="primary" loading={saving} onClick={() => void saveTime()}>
                保存提醒时间
              </Button>
              <Alert showIcon type="info" message={permissionCopy(permission)} />
              <Button icon={<BellOutlined />} onClick={requestPermission}>
                {permission === 'granted' ? '重新检查系统通知' : '启用系统通知'}
              </Button>
            </Space>
          )}
        </Card>
        <Card
          title={
            <>
              <SafetyOutlined /> 浏览器限制
            </>
          }
        >
          <Alert
            showIcon
            type="warning"
            message="关闭后的提醒仅尽力而为"
            description="页面可见且浏览器允许执行时，One Day 会在目标后 60 秒内提醒。进入受限后台、设备挂起、浏览器或 PWA 完全关闭后，本地计时器可能暂停；重新打开时只补发过去 15 分钟内的未送达提醒。更早的提醒不会打扰你，任务仍保留在恢复视图。"
          />
          <Typography.Paragraph>
            拒绝或不支持系统通知不会影响待办、日历和应用内提醒。通知权限只会在你点击启用按钮后请求。
          </Typography.Paragraph>
        </Card>
      </div>
    </section>
  );
}
