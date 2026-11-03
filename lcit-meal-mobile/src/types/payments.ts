/**
 * Types - Payments
 * Khớp với backend Payment.js và schema database
 */

import type { Meal, MealGuestCount, MealRegistration } from './meals';
import type { User } from './auth';

export interface MonthlyCollectionBoard {
  users: Pick<User, 'id' | 'fullName' | 'username' | 'facilityId'>[];
  registrations: MealRegistration[];
  meals: Meal[];
  guests: MealGuestCount[];
  payments: Payment[];
  settings: { settingKey: string; settingValue: string }[];
}

export type PaymentStatus = 'unpaid' | 'paid' | 'overdue';

export interface Payment {
  id: number;
  userId: number;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  isPaid: boolean | number;
  paidAmount?: number | null;
  paidAt?: string | null;
  billImg?: string | null;
  status: PaymentStatus;
  userName?: string;
  user?: {
    id: number;
    fullName: string;
    username: string;
    email?: string | null;
    phone?: string | null;
  };
}

export interface PaymentSummary {
  totalUnpaidAmount: number;
  unpaidCount: number;
  overdueCount: number;
  latestPaymentDate?: string;
}

export interface MealLedgerDay {
  date: string;
  staff: number;
  guests: number;
  amount: number;
  unpaidAmount: number;
}
export interface MealLedgerMonth {
  month: string;
  days: MealLedgerDay[];
  mealAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  totalAmount: number;
  unpaidAmount: number;
  dueDate: string;
}
export interface MealLedger extends PaymentSummary {
  currentMonth: string;
  months: MealLedgerMonth[];
}

export interface CreatePaymentRequest {
  userId: number;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  status?: PaymentStatus;
}

export interface UpdatePaymentRequest {
  paymentDate?: string;
  amount?: number;
  status?: PaymentStatus;
}

export interface MarkPaidRequest {
  paidAmount?: number;
  billImg?: string | null;
}

export interface PaymentFilterParams {
  userId?: number;
  status?: PaymentStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
