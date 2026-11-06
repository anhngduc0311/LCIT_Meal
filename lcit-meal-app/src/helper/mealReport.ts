import facilityOneNames from "../data/FacilityOneNames.json";
import type { Meal } from "../api/services/MealService";
import type { Payment } from "../api/services/PaymentService";

export type ReportPerson = { id: number; fullName: string; username: string; facilityId: 1 | 2 | null };
export type ReportRegistration = { userId: number; mealDate: string; guestCount: number; status: string };
export type MonthlyBoard = {
  users: ReportPerson[];
  registrations: ReportRegistration[];
  meals: Meal[];
  guests: { mealDate: string; facilityId: number; guestCount: number }[];
  payments: Payment[];
};
export type DailyMealReport = { date: string; staff: number; guests: number; total: number; cancelled: number; pending: number };

const normalize = (name: string) => name.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
const roster = new Set(facilityOneNames.map(normalize));
const count = (value: unknown) => Math.max(0, Number(value) || 0);
const activeRegistration = (status: string) => status === "confirmed" || status === "completed";

export function buildSiteOneReport(board: MonthlyBoard, month: string) {
  const users = board.users.filter(user => user.username.trim().toLowerCase() !== "quanly"
    && (user.facilityId === 1 || (user.facilityId !== 2 && roster.has(normalize(user.fullName)))));
  const ids = new Set(users.map(user => user.id));
  const registrations = board.registrations.filter(row => ids.has(row.userId) && row.mealDate.startsWith(`${month}-`));
  const meals = board.meals.filter(meal => meal.mealDate.startsWith(`${month}-`));
  const activeDates = new Set(meals.filter(meal => !Number(meal.isCancelled) && meal.status === "active").map(meal => meal.mealDate));
  const guests = board.guests.filter(row => row.facilityId === 1 && activeDates.has(row.mealDate));
  const payments = board.payments.filter(row => ids.has(row.userId) && row.paymentDate.startsWith(`${month}-`));
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const daily: DailyMealReport[] = Array.from({ length: days }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`, staff: 0, guests: 0, total: 0, cancelled: 0, pending: 0,
  }));
  const byDate = new Map(daily.map(day => [day.date, day]));
  for (const row of registrations) {
    const day = byDate.get(row.mealDate);
    if (!day) continue;
    if (row.status === "cancelled") day.cancelled++;
    if (row.status === "pending") day.pending++;
    if (activeDates.has(row.mealDate) && activeRegistration(row.status)) {
      day.staff++;
      day.guests += count(row.guestCount);
    }
  }
  for (const row of guests) byDate.get(row.mealDate)!.guests += count(row.guestCount);
  for (const day of daily) day.total = day.staff + day.guests;
  const totals = daily.reduce((sum, day) => ({
    staff: sum.staff + day.staff, guests: sum.guests + day.guests, total: sum.total + day.total,
    cancelled: sum.cancelled + day.cancelled, pending: sum.pending + day.pending,
  }), { staff: 0, guests: 0, total: 0, cancelled: 0, pending: 0 });
  const due = payments.reduce((sum, payment) => sum + count(payment.amount), 0);
  const paidAmount = (payment: Payment) => payment.status === "paid" || Boolean(payment.isPaid)
    ? count(payment.paidAmount ?? payment.amount) : count(payment.paidAmount);
  const collected = payments.reduce((sum, payment) => sum + paidAmount(payment), 0);
  const outstanding = payments.reduce((sum, payment) => sum + Math.max(0, count(payment.amount) - paidAmount(payment)), 0);
  return { month, users, registrations, payments, guests, daily, totals, activeDates,
    totalRequests: registrations.length, due, collected, outstanding };
}

export type SiteOneReport = ReturnType<typeof buildSiteOneReport>;
export type ReportCell = string | number;

export function attendanceRows(report: SiteOneReport): ReportCell[][] {
  const rows: ReportCell[][] = [[`BẢNG CHẤM CƠM CƠ SỞ 1 · ${report.month}`],
    ["STT", "Cán bộ", ...report.daily.map(day => day.date.slice(-2)), "Tổng cán bộ", "Khách đi kèm", "Tổng suất"]];
  for (const [index, user] of report.users.entries()) {
    const records = report.registrations.filter(row => row.userId === user.id && activeRegistration(row.status) && report.activeDates.has(row.mealDate));
    const days = new Set(records.map(row => row.mealDate));
    const guests = records.reduce((sum, row) => sum + count(row.guestCount), 0);
    rows.push([index + 1, user.fullName, ...report.daily.map(day => days.has(day.date) ? 1 : ""), days.size, guests, days.size + guests]);
  }
  const extra = report.guests.reduce((sum, row) => sum + count(row.guestCount), 0);
  rows.push(["", "Khách đăng ký riêng", ...report.daily.map(day => report.guests.filter(row => row.mealDate === day.date).reduce((sum, row) => sum + count(row.guestCount), 0)), 0, extra, extra]);
  rows.push(["", "TỔNG SUẤT (CÁN BỘ + KHÁCH)", ...report.daily.map(day => day.total), report.totals.staff, report.totals.guests, report.totals.total]);
  return rows;
}

export function registrationRows(report: SiteOneReport): ReportCell[][] {
  const names = new Map(report.users.map(user => [user.id, user.fullName]));
  const labels: Record<string, string> = { confirmed: "Đã xác nhận", completed: "Đã ăn", cancelled: "Đã cắt", pending: "Chờ duyệt" };
  return [["Cán bộ", "Ngày ăn", "Khách đi kèm", "Trạng thái", "Suất có hiệu lực"],
    ...report.registrations.map(row => [names.get(row.userId) || "", row.mealDate, count(row.guestCount),
      labels[row.status] || row.status, report.activeDates.has(row.mealDate) && activeRegistration(row.status) ? 1 + count(row.guestCount) : 0]),
    ...report.guests.map(row => ["Khách đăng ký riêng cơ sở 1", row.mealDate, count(row.guestCount), "Đã xác nhận", count(row.guestCount)])];
}
