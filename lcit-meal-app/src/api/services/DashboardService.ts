import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// Khớp với payload trả về của DashboardRepository.getHomeData() ở backend
// (gọi qua stored procedure sp_dashboard_home).

export type TodayMeal = {
  meal_id: number;
  meal_date: string;
  is_cancelled: 0 | 1;
  cancel_note: string | null;
  total_meal_slots: number;
  meal_price: string | null;
  guest_meal_price: string | null;
} | null;

export type TodayStaff = {
  registered_staff_count: number;
  total_guest_count: number;
  total_meal_slots: number;
} | null;

export type WeeklyChartPoint = {
  meal_date: string;
  is_cancelled: 0 | 1;
  total_meal_slots: number;
  registered_staff_count: number;
};

export type PaymentListItem = {
  user_id: number;
  full_name: string;
  username: string;
  payment_date: string | null;
  amount: number | null;
  paid_amount: number | null;
  is_paid: 0 | 1 | null;
  payment_status: string | null;
};

export type Outstanding = {
  unpaid_record_count: number;
  total_outstanding_amount: number;
} | null;

export type DashboardHomeData = {
  todayMeal: TodayMeal;
  todayStaff: TodayStaff;
  weeklyChart: WeeklyChartPoint[];
  paymentList: PaymentListItem[];
  outstanding: Outstanding;
  pendingMealOptionCount: number;
  unseenNotificationCount: number;
};

export type DashboardChartPeriod = "week" | "month" | "year";

// Khớp với payload trả về của DashboardRepository.getChartByPeriod() -
// mỗi phần tử data[i].meal_date là "YYYY-MM-DD" khi granularity = "day",
// hoặc "YYYY-MM" khi granularity = "month" (filter theo năm).
export type DashboardChartData = {
  period: DashboardChartPeriod;
  // Có giá trị khi là số liệu CÁ NHÂN của người đó; null = toàn cơ quan.
  userId?: number | null;
  granularity: "day" | "month";
  from: string;
  to: string;
  data: WeeklyChartPoint[];
};

export class DashboardService {
  constructor(private readonly client = apiClient) {}

  async getHome(facilityId?: 1 | 2): Promise<DashboardHomeData> {
    const response =
      await this.client.get<ApiResponse<DashboardHomeData>>(
        `/dashboard/home${facilityId ? `?facilityId=${facilityId}` : ""}`,
      );
    return response.payload;
  }

  // date: "YYYY-MM-DD" bất kỳ trong khoảng muốn xem (mặc định hôm nay ở backend)
  // userId: có -> số liệu CÁ NHÂN của người đó (chỉ xem được của chính mình,
  // trừ admin/manager); không có -> số liệu toàn cơ quan.
  async getChart(
    period: DashboardChartPeriod,
    date?: string,
    userId?: number,
    facilityId?: 1 | 2,
  ): Promise<DashboardChartData> {
    const params = new URLSearchParams({ period });
    if (date) params.set("date", date);
    if (userId !== undefined) params.set("userId", String(userId));
    if (facilityId !== undefined) params.set("facilityId", String(facilityId));

    const response = await this.client.get<ApiResponse<DashboardChartData>>(
      `/dashboard/chart?${params.toString()}`,
    );
    return response.payload;
  }
}

export const dashboardService = new DashboardService();
