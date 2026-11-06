import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// Khớp với models/MealScheduleConfig.js ở backend.
// dayOfWeek: 0 = Chủ Nhật ... 6 = Thứ Bảy.
export type MealScheduleDay = {
  id: number;
  dayOfWeek: number;
  isEnabled: boolean;
  notes: string | null;
  updatedBy: number | null;
  updatedByName?: string | null;
  updatedAt: string;
  createdAt: string;
};

export type MealScheduleConfigResponse = {
  days: MealScheduleDay[];
  // Cờ toàn cục: job tự động tạo lịch/đăng ký ăn (autoScheduleJob) có áp
  // dụng cấu hình này hay không. Tắt = tạo bếp ăn cho TẤT CẢ các ngày.
  useMealConfig: boolean;
};

export type UpdateMealScheduleDayRequest = {
  dayOfWeek: number;
  isEnabled: boolean;
  notes?: string;
};

export type UpdateMealScheduleConfigRequest = {
  days?: UpdateMealScheduleDayRequest[];
  useMealConfig?: boolean;
};

export class MealScheduleConfigService {
  constructor(private readonly client = apiClient) {}

  async get(): Promise<MealScheduleConfigResponse> {
    const res = await this.client.get<ApiResponse<MealScheduleConfigResponse>>(
      "/system-settings/meal-schedule-config",
    );
    return res.payload;
  }

  async update(
    payload: UpdateMealScheduleConfigRequest,
  ): Promise<MealScheduleConfigResponse> {
    const res = await this.client.put<ApiResponse<MealScheduleConfigResponse>>(
      "/system-settings/meal-schedule-config",
      payload,
    );
    return res.payload;
  }
}

export const mealScheduleConfigService = new MealScheduleConfigService();
