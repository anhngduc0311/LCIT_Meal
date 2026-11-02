/**
 * Types - Meals, Registrations, Options and Holidays
 * Khớp với backend constants và schema database
 */

export interface Meal {
  completionStatus?: 'pending' | 'serving' | 'completed';
  id: number;
  mealDate: string; // YYYY-MM-DD
  isCancelled: boolean | number;
  cancelledBy?: number | null;
  note?: string | null;
  status: 'active' | 'cancelled' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealGuestCount {
  mealId: number;
  mealDate: string;
  facilityId: 1 | 2;
  guestCount: number;
}

export type MealRegistrationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface MealRegistration {
  id: number;
  userId: number;
  userName?: string;
  mealId: number;
  guestCount: number; // 0..10
  status: MealRegistrationStatus;
  createdAt?: string;
  mealDate?: string; // Joined date
  meal?: Meal;
  user?: {
    id: number;
    fullName: string;
    username: string;
    email?: string | null;
    phone?: string | null;
  };
}

export type MealOptionType = 'cancel_today' | 'cancel_schedule' | 'cancel_permanent';

export type MealOptionStatus = 'pending' | 'approved' | 'rejected';

export interface MealOption {
  id: number;
  userId: number;
  userName?: string;
  type: MealOptionType;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  note?: string | null;
  status: MealOptionStatus;
  createdAt?: string;
  createdBy?: number | null;
  updatedAt?: string;
  approvedAt?: string | null;
  approvedBy?: number | null;
  user?: {
    id: number;
    fullName: string;
    username: string;
    email?: string | null;
    phone?: string | null;
  };
}

export interface HolidayEvent {
  id: number;
  name: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  reason?: string | null;
  status: string;
  createdAt?: string;
}

export interface RegisterMealRequest {
  mealId: number;
  guestCount?: number;
  userId?: number;
}

export interface CancelMealRegistrationRequest {
  registrationId: number;
  reason?: string;
}

export interface CreateMealOptionRequest {
  type: MealOptionType;
  fromDate: string;
  toDate: string;
  note?: string;
  userId?: number;
}

export interface MealSummaryResponse {
  meal: Meal;
  totalRegistrations: number;
  totalGuests: number;
  totalMealSlots: number;
}

export interface CreateMealRequest {
  mealDate: string;
  note?: string;
  status?: string;
}

export interface UpdateMealRequest {
  mealDate?: string;
  note?: string;
  status?: string;
}

export interface CreateHolidayEventRequest {
  name: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export interface MealRegistrationFilterParams {
  userId?: number;
  mealId?: number;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface MealOptionFilterParams {
  userId?: number;
  type?: MealOptionType;
  status?: MealOptionStatus;
  page?: number;
  limit?: number;
}
