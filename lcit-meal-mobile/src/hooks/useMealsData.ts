/**
 * Hooks - Meal and Registration Data
 * Quản lý queries và mutations cho lịch ăn, đăng ký suất, hủy suất và cấu hình
 * Tự động đồng bộ và làm mới cache sau mỗi thao tác (T22, T25)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { mealService } from '../services/mealService';
import {
  Meal,
  MealRegistration,
  MealOption,
  HolidayEvent,
  MealScheduleConfig,
  RegisterMealRequest,
  CreateMealOptionRequest,
} from '../types';

export const MEAL_QUERY_KEYS = {
  meals: (useMock: boolean) => ['meals', { useMock }] as const,
  registrations: (useMock: boolean) => ['meal-registrations', 'me', { useMock }] as const,
  mealOptions: (useMock: boolean) => ['meal-options', 'me', { useMock }] as const,
  holidays: (useMock: boolean) => ['holidays', { useMock }] as const,
  scheduleConfig: (useMock: boolean) => ['schedule-config', { useMock }] as const,
};

export function useMeals() {
  const { useMockData } = useAuth();
  return useQuery<Meal[], Error>({
    queryKey: MEAL_QUERY_KEYS.meals(useMockData),
    queryFn: () => mealService.getMeals(useMockData),
  });
}

export function useMyRegistrations() {
  const { useMockData } = useAuth();
  return useQuery<MealRegistration[], Error>({
    queryKey: MEAL_QUERY_KEYS.registrations(useMockData),
    queryFn: () => mealService.getMyRegistrations(useMockData),
  });
}

export function useMyMealOptions() {
  const { useMockData } = useAuth();
  return useQuery<MealOption[], Error>({
    queryKey: MEAL_QUERY_KEYS.mealOptions(useMockData),
    queryFn: () => mealService.getMyMealOptions(useMockData),
  });
}

export function useHolidays() {
  const { useMockData } = useAuth();
  return useQuery<HolidayEvent[], Error>({
    queryKey: MEAL_QUERY_KEYS.holidays(useMockData),
    queryFn: () => mealService.getHolidays(useMockData),
  });
}

export function useScheduleConfig() {
  const { useMockData } = useAuth();
  return useQuery<MealScheduleConfig, Error>({
    queryKey: MEAL_QUERY_KEYS.scheduleConfig(useMockData),
    queryFn: () => mealService.getScheduleConfig(useMockData),
  });
}

/**
 * Mutation: Đăng ký suất ăn
 */
export function useRegisterMealMutation() {
  const queryClient = useQueryClient();
  const { useMockData } = useAuth();

  return useMutation<MealRegistration, Error, RegisterMealRequest>({
    mutationFn: (data) => mealService.registerMeal(data, useMockData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Mutation: Cập nhật số lượng khách
 */
export function useUpdateGuestCountMutation() {
  const queryClient = useQueryClient();
  const { useMockData } = useAuth();

  return useMutation<
    MealRegistration,
    Error,
    { mealId: number; guestCount: number; registrationId?: number }
  >({
    mutationFn: ({ mealId, guestCount, registrationId }) =>
      mealService.updateGuestCount(mealId, guestCount, registrationId, useMockData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

/**
 * Mutation: Cắt suất trực tiếp
 */
export function useCancelRegistrationMutation() {
  const queryClient = useQueryClient();
  const { useMockData } = useAuth();

  return useMutation<MealRegistration, Error, { registrationId: number; reason?: string }>({
    mutationFn: ({ registrationId, reason }) =>
      mealService.cancelRegistration(registrationId, reason, useMockData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Mutation: Tạo yêu cầu cắt suất
 */
export function useCreateMealOptionMutation() {
  const queryClient = useQueryClient();
  const { useMockData } = useAuth();

  return useMutation<MealOption, Error, CreateMealOptionRequest>({
    mutationFn: (data) => mealService.createMealOption(data, useMockData),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['meal-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
