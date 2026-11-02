/**
 * Hooks - Payments Data
 * Quản lý queries cho danh sách và tóm tắt thanh toán cá nhân (T23)
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { paymentService } from '../services/paymentService';
import { Payment, MealLedger } from '../types';

export const PAYMENT_QUERY_KEYS = {
  myPayments: (useMock: boolean) => ['payments', 'me', { useMock }] as const,
  mySummary: (useMock: boolean) => ['payments', 'summary', { useMock }] as const,
};

export function useMyPayments() {
  const { useMockData } = useAuth();
  return useQuery<Payment[], Error>({
    queryKey: PAYMENT_QUERY_KEYS.myPayments(useMockData),
    queryFn: () => paymentService.getMyPayments(useMockData),
    refetchInterval: 60000,
  });
}

export function useMyPaymentSummary() {
  const { useMockData } = useAuth();
  return useQuery<MealLedger, Error>({
    queryKey: PAYMENT_QUERY_KEYS.mySummary(useMockData),
    queryFn: () => paymentService.getMyMealLedger(useMockData),
    refetchInterval: 60000,
  });
}
