import { useEffect } from 'react';
import { toast } from 'sonner';

import type { ReminderDelivery } from '@/application';

import { getApplicationServices } from './application';

export function ReminderRuntimeHost() {
  useEffect(() => {
    let active = true;
    void getApplicationServices().then(({ reminderRuntime }) => {
      if (active) reminderRuntime.start();
    });
    const show = (event: Event) => {
      const delivery = (event as CustomEvent<ReminderDelivery>).detail;
      toast.info(delivery.title, {
        id: delivery.trigger.deliveryKey,
        description: '提醒时间已到。你可以稍后提醒，但计划与截止时间不会改变。',
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: '10 分钟后提醒',
          onClick: () => {
            void getApplicationServices().then(async ({ reminders, reminderRuntime }) => {
              await reminders.snoozeForMinutes(delivery.reminder.id, 10);
              toast.dismiss(delivery.trigger.deliveryKey);
              await reminderRuntime.reconcile();
            });
          },
        },
      });
    };
    window.addEventListener('one-day:reminder', show);
    return () => {
      active = false;
      window.removeEventListener('one-day:reminder', show);
      void getApplicationServices().then(({ reminderRuntime }) => reminderRuntime.stop());
    };
  }, []);

  return null;
}
