import { useEffect, useState } from 'react';

/**
 * Date-relative projections need a clock invalidation even when IndexedDB does
 * not change. Database commits are observed separately by Dexie live queries.
 */
export function useClockTick(intervalMilliseconds = 30_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const advance = () => setTick((value) => value + 1);
    const advanceWhenVisible = () => {
      if (document.visibilityState === 'visible') advance();
    };
    const timer = window.setInterval(advance, intervalMilliseconds);
    window.addEventListener('focus', advance);
    window.addEventListener('pageshow', advance);
    document.addEventListener('visibilitychange', advanceWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', advance);
      window.removeEventListener('pageshow', advance);
      document.removeEventListener('visibilitychange', advanceWhenVisible);
    };
  }, [intervalMilliseconds]);

  return tick;
}
