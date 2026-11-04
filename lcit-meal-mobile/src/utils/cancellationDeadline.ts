import { formatBusinessDate } from './formatters';

export const CANCELLATION_CLOSED_MESSAGE = 'Đã quá hạn cắt suất. Suất ăn phải được cắt trước 08:00 sáng (giờ Việt Nam).';
const VIETNAM_OFFSET = 7 * 60 * 60 * 1000;

export function vietnamToday(now = Date.now()): string {
  return new Date(now + VIETNAM_OFFSET).toISOString().slice(0, 10);
}

export function isCancellationClosed(date: string | undefined, now = Date.now(), cutoffTime = '08:00'): boolean {
  const day = formatBusinessDate(date);
  if (!day) return true;
  const deadline = Date.parse(`${day}T${cutoffTime}:00+07:00`);
  return !Number.isFinite(deadline) || now >= deadline;
}

export function assertCancellationAllowed(date: string | undefined, now = Date.now()) {
  if (isCancellationClosed(date, now)) throw new Error(CANCELLATION_CLOSED_MESSAGE);
}

export function nextCancellationClockChange(now = Date.now(), cutoffTime = '08:00'): number {
  const today = vietnamToday(now);
  const cutoff = Date.parse(`${today}T${cutoffTime}:00+07:00`);
  const midnight = Date.parse(`${today}T00:00:00+07:00`) + 24 * 60 * 60 * 1000;
  return now < cutoff ? cutoff : midnight;
}
