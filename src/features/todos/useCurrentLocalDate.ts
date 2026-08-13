import { useEffect, useState } from 'react';

import type { LocalDate, TimeZoneId } from '@/domain';

import { todayInTimeZone } from './task-view';

const DATE_REFRESH_INTERVAL_MS = 60_000;

/** Keeps date-based list projections correct when an open tab crosses local midnight. */
export function useCurrentLocalDate(
  timeZone: TimeZoneId | undefined,
): LocalDate | undefined {
  const [, setRefreshCount] = useState(0);

  useEffect(() => {
    if (timeZone === undefined) return;
    const interval = window.setInterval(
      () => setRefreshCount((count) => count + 1),
      DATE_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [timeZone]);

  return timeZone === undefined ? undefined : todayInTimeZone(timeZone);
}
