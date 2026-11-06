import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

export type HolidayEventStatus = "active" | "restored";

export type HolidayEvent = {
  id: number;
  name: string;
  reason: string | null;
  fromDate: string;
  toDate: string;
  status: HolidayEventStatus;
  createdBy: number | null;
  createdByName?: string | null;
  createdAt: string;
  restoredBy: number | null;
  restoredAt: string | null;
};

export type CreateHolidayEventRequest = {
  name: string;
  reason?: string;
  fromDate: string;
  toDate: string;
};

export class HolidayEventService {
  constructor(private readonly client = apiClient) {}

  async list(): Promise<HolidayEvent[]> {
    const res =
      await this.client.get<ApiResponse<HolidayEvent[]>>("/holiday-events");
    return res.payload;
  }

  async getById(id: number | string): Promise<HolidayEvent> {
    const res = await this.client.get<ApiResponse<HolidayEvent>>(
      `/holiday-events/${id}`,
    );
    return res.payload;
  }

  // Tạo sự kiện "Hủy lịch" (nghỉ lễ/Tết/sự kiện) - chọn 1 ngày hoặc 1
  // khoảng ngày, đặt tên + lý do. Áp dụng cho TOÀN BỘ nhân viên (khác với
  // meal-options vốn chỉ cắt suất cho 1 người).
  async create(payload: CreateHolidayEventRequest): Promise<HolidayEvent> {
    const res = await this.client.post<ApiResponse<HolidayEvent>>(
      "/holiday-events",
      payload,
    );
    return res.payload;
  }

  // Mở lại sự kiện đã tạo nhầm - chỉ mở lại trạng thái bếp ăn, các suất ăn
  // đã bị hủy sẽ không tự đăng ký lại.
  async restore(id: number | string): Promise<HolidayEvent> {
    const res = await this.client.patch<ApiResponse<HolidayEvent>>(
      `/holiday-events/${id}/restore`,
    );
    return res.payload;
  }
}

export const holidayEventService = new HolidayEventService();
