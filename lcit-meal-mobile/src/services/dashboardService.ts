/**
 * Dashboard Service
 * Lấy dữ liệu tổng quan quản lý và biểu đồ theo chu kỳ (Tuần / Tháng / Năm)
 */

import { apiClient } from './apiClient';
import { mockStore } from './mockStore';
import { DashboardHomeData, DashboardChartResponse } from '../types';
import type { FacilityFilter } from '../utils/facilities';

export const dashboardService = {
  /**
   * Lấy dữ liệu tổng quan trang chủ quản lý: GET /api/dashboard/home
   */
  async getHome(useMock = false, date?: string): Promise<DashboardHomeData> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getDashboardHome(date);
    }
    return await apiClient<DashboardHomeData>(`/dashboard/home${date ? `?date=${encodeURIComponent(date)}` : ''}`);
  },

  /**
   * Lấy biểu đồ theo chu kỳ: GET /api/dashboard/chart?period=week|month|year&date=YYYY-MM-DD
   */
  async getChart(
    period: 'week' | 'month' | 'year' = 'week',
    date?: string,
    useMock = false,
    facility: FacilityFilter = 'all'
  ): Promise<DashboardChartResponse> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getDashboardChart(period, date, facility);
    }
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (date) params.append('date', date);
    if (facility !== 'all') params.append('facilityId', String(facility));

    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiClient<DashboardChartResponse>(`/dashboard/chart${query}`);
  },
};
