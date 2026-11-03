import type { Meal, MealGuestCount, MealRegistration, Payment, User } from '../types';
import { buildMonthlyMeals, monthRange } from './monthlyMeals';
import { FacilityId, FacilityOverrides, getFacility } from './facilities';

export function buildMonthlyCollections(month: string, users: (Pick<User, 'id' | 'fullName' | 'username'> & { facilityId?: FacilityId | null })[],
  records: MealRegistration[], meals: Meal[], payments: Payment[], price: number, guestPrice: number,
  guests: MealGuestCount[] = [], scope: { facilityId?: FacilityId; throughDate?: string; overrides?: FacilityOverrides } = {}) {
  if (![price, guestPrice].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Chưa cấu hình đơn giá suất ăn hợp lệ.');
  if (scope.facilityId !== undefined) {
    users = users.filter(user => getFacility(user, scope.overrides) === scope.facilityId);
    const scopedIds = new Set(users.map(user => user.id));
    records = records.filter(record => scopedIds.has(record.userId));
    payments = payments.filter(payment => scopedIds.has(payment.userId));
    guests = guests.filter(guest => guest.facilityId === scope.facilityId);
  }
  if (scope.throughDate) {
    const throughDate = scope.throughDate;
    records = records.filter(record => (record.mealDate || record.meal?.mealDate || '') <= throughDate);
    meals = meals.filter(meal => meal.mealDate <= throughDate);
    payments = payments.filter(payment => payment.paymentDate.slice(0, 10) <= throughDate);
    guests = guests.filter(guest => guest.mealDate <= throughDate);
  }
  const range = monthRange(month);
  const invoices = payments.filter(item => item.paymentDate.slice(0, 7) === month);
  const ids = [...new Set([...users.map(u => u.id), ...records.map(r => r.userId), ...invoices.map(p => p.userId)])];
  const table = buildMonthlyMeals(month, records, meals, ids, price, guestPrice, guests);
  const rows = ids.map(userId => {
    const person = users.find(u => u.id === userId);
    const stats = table.people.get(userId)!;
    const bills = invoices.filter(p => p.userId === userId);
    const staffAmount = stats.staff * price;
    const guestAmount = stats.guests * guestPrice;
    const mealAmount = staffAmount + guestAmount;
    const invoicedAmount = bills.reduce((sum, p) => sum + Number(p.amount), 0);
    const paidAmount = bills.reduce((sum, p) => sum + (p.status === 'paid' || p.isPaid === true || p.isPaid === 1
      ? Number(p.paidAmount ?? p.amount) : 0), 0);
    // An invoice represents the same meals, so it must not be added a second time.
    const totalAmount = Math.max(mealAmount, invoicedAmount);
    return { userId, name: person?.fullName || bills[0]?.userName || records.find(r => r.userId === userId)?.userName || `Cán bộ #${userId}`,
      username: person?.username || '', staff: stats.staff, guests: stats.guests, staffAmount, guestAmount,
      mealAmount, totalAmount, adjustmentAmount: totalAmount - mealAmount, paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount), creditAmount: Math.max(0, paidAmount - totalAmount), invoices: bills };
  }).filter(row => row.staff > 0 || row.invoices.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const standalone = ([1, 2] as const).filter(facilityId => scope.facilityId === undefined || facilityId === scope.facilityId).map(facilityId => {
    const count = guests.filter(g => g.facilityId === facilityId && g.mealDate >= range.from && g.mealDate <= range.to
      && meals.some(m => m.mealDate === g.mealDate && m.status === 'active' && !m.isCancelled))
      .reduce((sum, g) => sum + Math.max(0, Number(g.guestCount) || 0), 0);
    return { facilityId, count, amount: count * guestPrice };
  });
  return { rows, standalone, dueDate: range.to,
    staffAmount: rows.reduce((sum, row) => sum + row.staffAmount, 0),
    linkedGuestAmount: rows.reduce((sum, row) => sum + row.guestAmount, 0),
    standaloneGuestAmount: standalone.reduce((sum, row) => sum + row.amount, 0),
    paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0),
    remainingAmount: rows.reduce((sum, row) => sum + row.remainingAmount, 0) };
}
