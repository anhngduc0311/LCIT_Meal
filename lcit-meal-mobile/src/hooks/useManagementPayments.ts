/**
 * Hook - Management Payments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '../services/paymentService';
import { useAuth } from '../providers/AuthProvider';
import {
  PaymentFilterParams,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  MarkPaidRequest,
} from '../types';

export function useManagementPayments(params: PaymentFilterParams = {}) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['management', 'payments', params, isMockMode],
    queryFn: () => paymentService.filterPayments(params, isMockMode),
    refetchInterval: 60000,
  });
}

export function useCreatePayment() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePaymentRequest) => paymentService.createPayment(data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePayment() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePaymentRequest }) =>
      paymentService.updatePayment(id, data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkPaid() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MarkPaidRequest }) =>
      paymentService.markPaid(id, data, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePayment() {
  const { isMockMode } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => paymentService.deletePayment(id, isMockMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
