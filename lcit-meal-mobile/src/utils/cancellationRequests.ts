import type { MealOption } from '../types';

export function pendingCancellationRequests(options: MealOption[]): MealOption[] {
  return options.filter(record => record.status === 'pending' && ['cancel_schedule', 'cancel_permanent'].includes(record.type))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id - b.id);
}
