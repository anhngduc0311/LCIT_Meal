import type { Meal, MealRegistration, Payment } from '../types';

export function monthRange(month: string) {
  const [year, number] = month.split('-').map(Number);
  if (!/^\d{4}-\d{2}$/.test(month) || number < 1 || number > 12 || year < 2000) throw new Error('Tháng không hợp lệ');
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const dates = Array.from({ length: count }, (_, day) => `${month}-${String(day + 1).padStart(2, '0')}`);
  return { from: dates[0], to: dates[count - 1], dates };
}

export function shiftMonth(month: string, offset: number) {
  monthRange(month);
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export const countsAsMeal = (record?: MealRegistration) => record?.status === 'confirmed' || record?.status === 'completed';

export function buildMonthlyMeals(month: string, records: MealRegistration[], meals: Meal[], userIds: number[], price: number, guestPrice: number) {
  const { dates } = monthRange(month);
  const dateSet = new Set(dates);
  const ids = new Set(userIds);
  const mealsByDate = new Map(meals.filter(m => dateSet.has(m.mealDate)).map(m => [m.mealDate, m]));
  const cells = new Map<string, MealRegistration>();
  const people = new Map(userIds.map(id => [id, { staff: 0, guests: 0, amount: 0 }]));
  const days = new Map(dates.map(date => [date, { staff: 0, guests: 0, total: 0 }]));
  let completed = 0;
  for (const record of records) {
    const date = record.mealDate || record.meal?.mealDate || '';
    if (!dateSet.has(date) || !ids.has(record.userId)) continue;
    const key = `${date}:${record.userId}`;
    if (cells.has(key)) continue;
    cells.set(key, record);
    const meal = mealsByDate.get(date);
    if (!meal || meal.isCancelled || meal.status !== 'active' || !countsAsMeal(record)) continue;
    const guests = Math.max(0, Number(record.guestCount) || 0);
    const person = people.get(record.userId)!;
    person.staff++; person.guests += guests; person.amount += price + guests * guestPrice;
    const day = days.get(date)!;
    day.staff++; day.guests += guests; day.total += 1 + guests;
    if (record.status === 'completed') completed += 1 + guests;
  }
  return { cells, people, days, mealsByDate, completed,
    total: [...days.values()].reduce((sum, day) => sum + day.total, 0),
    amount: [...people.values()].reduce((sum, person) => sum + person.amount, 0) };
}

export function monthlyPaymentState(payments: Payment[], userId: number, month: string) {
  const invoices = payments.filter(p => p.userId === userId && p.paymentDate.slice(0, 7) === month);
  if (!invoices.length) return { label: 'Chưa lập', paid: false, invoices };
  const paid = invoices.every(p => p.status === 'paid' || Boolean(p.isPaid));
  return { label: paid ? 'Đã thu' : 'Chưa thu', paid, invoices };
}
