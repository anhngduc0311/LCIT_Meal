/**
 * Hook - Management Meals & Holidays
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealService } from '../services/mealService';
import { useAuth } from '../providers/AuthProvider';
import { CreateMealRequest, UpdateMealRequest, CreateHolidayEventRequest } from '../types';

export function useManagementMeals(params: { from?: string; to?: string; status?: string; isCancelled?: boolean } = {}) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['management', 'meals', params, isMockMode],
    queryFn: () => mealService.filterMeals(params, isMockMode),
  });
}

export function useMealGuestCounts(params: { from?: string; to?: string } = {}) {
  const { isMockMode } = useAuth();
  return useQuery({ queryKey: ['meal-guests', params, isMockMode], queryFn: () => mealService.getMealGuestCounts(params, isMockMode) });
}

export function useMealSummary(mealId: number) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['management', 'meals', mealId, 'summary', isMockMode],
    queryFn: () => mealService.getMealSummary(mealId, isMockMode),
    enabled: mealId > 0,
  });
}

export function useCreateMeal() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMealRequest) => mealService.createMeal(data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateMeal() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMealRequest }) =>
      mealService.updateMeal(id, data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

export function useCancelMeal() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      mealService.cancelMeal(id, reason, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRestoreMeal() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.restoreMeal(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useHolidayEvents() {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['holidays', isMockMode],
    queryFn: () => mealService.getHolidays(isMockMode),
  });
}

export function useCreateHoliday() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHolidayEventRequest) => mealService.createHoliday(data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

export function useRestoreHoliday() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.restoreHoliday(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}
