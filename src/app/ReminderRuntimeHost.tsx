import { App, Button } from 'antd';
import { useEffect } from 'react';

import type { ReminderDelivery } from '@/application';

import { getApplicationServices } from './application';

export function ReminderRuntimeHost() {
  const { notification } = App.useApp();

  useEffect(() => {
    let active = true;
    void getApplicationServices().then(({ reminderRuntime }) => {
      if (active) reminderRuntime.start();
    });
    const show = (event: Event) => {
      const delivery = (event as CustomEvent<ReminderDelivery>).detail;
      notification.info({
        key: delivery.trigger.deliveryKey,
        message: delivery.title,
        description: '提醒时间已到。你可以稍后提醒，但计划与截止时间不会改变。',
        duration: 0,
        btn: (
          <Button
            size="small"
            onClick={() => {
              void getApplicationServices().then(
                async ({ reminders, reminderRuntime }) => {
                  await reminders.snoozeForMinutes(delivery.reminder.id, 10);
                  notification.destroy(delivery.trigger.deliveryKey);
                  await reminderRuntime.reconcile();
                },
              );
            }}
          >
            10 分钟后提醒
          </Button>
        ),
      });
    };
    window.addEventListener('one-day:reminder', show);
    return () => {
      active = false;
      window.removeEventListener('one-day:reminder', show);
      void getApplicationServices().then(({ reminderRuntime }) => reminderRuntime.stop());
    };
  }, [notification]);

  return null;
}
