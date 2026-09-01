import { useSyncExternalStore } from 'react';

const CHANNEL_NAME = 'one-day-application-changes';

let revision = 0;
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel(CHANNEL_NAME);

function publishLocalChange() {
  revision += 1;
  for (const listener of listeners) listener();
}

channel?.addEventListener('message', publishLocalChange);

/** Called only after a UnitOfWork transaction commits successfully. */
export function notifyApplicationChanged() {
  publishLocalChange();
  channel?.postMessage({ kind: 'committed' });
}

export function subscribeApplicationChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApplicationRevision() {
  return revision;
}

export function useApplicationRevision() {
  return useSyncExternalStore(
    subscribeApplicationChanges,
    getApplicationRevision,
    getApplicationRevision,
  );
}
