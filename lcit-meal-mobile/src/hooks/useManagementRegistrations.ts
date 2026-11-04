/**
 * Hook - Management Registrations & Options
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealService } from '../services/mealService';
import { useAuth } from '../providers/AuthProvider';
import {
  MealRegistrationFilterParams,
  MealOptionFilterParams,
  RegisterMealRequest,
  CreateMealOptionRequest,
} from '../types';

export function useManagementRegistrations(params: MealRegistrationFilterParams = {}) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['management', 'registrations', params, isMockMode],
    queryFn: () => mealService.filterRegistrations(params, isMockMode),
  });
}

export function useApproveCancelRegistration() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.approveCancelRegistration(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRejectCancelRegistration() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.rejectCancelRegistration(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useConfirmRegistration() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.confirmRegistration(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRegisterOnBehalf() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterMealRequest) => mealService.registerMeal(data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useManagementMealOptions(params: MealOptionFilterParams = {}) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['management', 'meal-options', params, isMockMode],
    queryFn: () => mealService.filterMealOptions(params, isMockMode),
  });
}

export function useReactivateMealOption() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fromDate }: { id: number; fromDate: string }) => mealService.reactivateMealOption(id, fromDate, isMockMode),
    onSuccess: async () => { await queryClient.invalidateQueries(); },
  });
}

export function useApproveMealOption() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.approveMealOption(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRejectMealOption() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => mealService.rejectMealOption(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateOptionOnBehalf() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMealOptionRequest) => mealService.createMealOption(data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['meal-options'] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
