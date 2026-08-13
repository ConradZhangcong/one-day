import type { ReminderDelivery } from '../../application';

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Call directly from a click handler; do not place an await before this call. */
export function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
  return Notification.requestPermission();
}

export function deliverBrowserReminder(delivery: ReminderDelivery): void {
  window.dispatchEvent(
    new CustomEvent<ReminderDelivery>('one-day:reminder', { detail: delivery }),
  );
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(delivery.title, { body: 'One Day 提醒：现在可以处理这项待办。' });
  }
}
