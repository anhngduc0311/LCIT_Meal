import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// Khớp với kết quả trả về của MealScheduleService.generateMonth() ở backend
// (src/services/MealScheduleService.js).
export type RunAutoScheduleResult = {
  month?: string;
  // Ngày đầu tiên được tạo lịch: hôm nay, hoặc ngày mai nếu đã qua giờ hoàn
  // thành suất ăn. Các ngày trước mốc này không được tạo.
  startDate?: string;
  createdMeals?: number;
  createdRegistrations?: number;
  // Số người dùng THỰC SỰ được bổ sung lịch ở lượt này (vd người dùng mới).
  usersScheduled?: number;
  // Số cặp (người dùng, ngày) đã có lịch sẵn nên được bỏ qua.
  skippedExistingRegistrations?: number;
  skippedPastDates?: number;
  // Số ngày trong tháng bị bỏ qua vì rơi vào 1 sự kiện "hủy lịch"
  // (holiday_event) đang active - xem HolidayEventService.
  skippedHolidayDates?: number;
  // Số ngày trong tháng bị bỏ qua vì KHÔNG nằm trong cấu hình "Các ngày ăn
  // trong tuần" (Quản lý cấu hình hệ thống) - thường là Thứ 7, Chủ Nhật.
  skippedNonScheduleDates?: number;
  // Chỉ có khi cronjob tự động bị tắt (auto_register_enabled). Bấm nút thủ
  // công luôn chạy nên không bao giờ nhận được giá trị này.
  skipped?: boolean;
};

export class AdminToolsService {
  constructor(private readonly client = apiClient) {}

  // admin, manager - Nút "Tạo lịch ăn": kiểm tra TẤT CẢ người dùng đang hoạt
  // động, người đã có lịch thì bỏ qua, người chưa có (vd người dùng mới) được
  // tạo từ hôm nay (hoặc ngày mai nếu đã qua giờ hoàn thành suất ăn) đến hết
  // tháng. Tự loại trừ các ngày rơi vào sự kiện hủy lịch đang active.
  // An toàn khi gọi lại nhiều lần cho cùng 1 tháng: KHÔNG tạo trùng.
  async runAutoSchedule(month: string): Promise<RunAutoScheduleResult> {
    const res = await this.client.post<ApiResponse<RunAutoScheduleResult>>(
      `/admin-tools/run-auto-schedule?month=${encodeURIComponent(month)}`,
    );
    return res.payload;
  }
}

export const adminToolsService = new AdminToolsService();
