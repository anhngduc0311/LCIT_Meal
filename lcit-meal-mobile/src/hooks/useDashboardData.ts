/**
 * Hook - Dashboard Data
 * Lấy dữ liệu tổng quan quản lý và biểu đồ
 */

import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../providers/AuthProvider';
import type { FacilityFilter } from '../utils/facilities';

export function useDashboardHome(date?: string) {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['dashboard', 'home', isMockMode, date],
    queryFn: () => dashboardService.getHome(isMockMode, date),
    refetchInterval: 30000,
  });
}

export function useDashboardChart(period: 'week' | 'month' | 'year' = 'week', date?: string, facility: FacilityFilter = 'all') {
  const { isMockMode } = useAuth();

  return useQuery({
    queryKey: ['dashboard', 'chart', period, date, isMockMode, facility],
    queryFn: () => dashboardService.getChart(period, date, isMockMode, facility),
  });
}
