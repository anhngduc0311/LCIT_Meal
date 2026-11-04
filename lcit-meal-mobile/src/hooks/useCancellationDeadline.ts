import { useEffect, useState } from 'react';
import { isCancellationClosed, nextCancellationClockChange, vietnamToday } from '../utils/cancellationDeadline';

export function useCancellationDeadline(date?: string, cutoffTime = '08:00') {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    // Update at the applicable cutoff and midnight without polling the meal list.
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, nextCancellationClockChange(now, cutoffTime) - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [now, cutoffTime]);
  return { closed: isCancellationClosed(date, now, cutoffTime), today: vietnamToday(now), now };
}
