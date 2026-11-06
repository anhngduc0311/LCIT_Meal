import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// ===== Bếp ăn theo ngày (bảng `meal`) =====

export type MealCompletionStatus = "completed" | "serving" | "pending";

export type Meal = {
  id: number;
  mealDate: string; // YYYY-MM-DD
  isCancelled: 0 | 1;
  cancelledBy: number | null;
  note: string | null;
  status: string;
  createdAt: string;
  // Trạng thái theo thời gian thực (tính từ meal_date + giờ cấu hình
  // "meal_completion_time"), do backend tính lại mỗi lần trả về từ
  // GET /meals/filter hoặc /meals/by-date - KHÔNG liên quan cột `status`.
  // "completed": đã qua ngày, hoặc là hôm nay nhưng đã qua giờ hoàn thành.
  // "serving": là hôm nay và chưa tới giờ hoàn thành -> đang phục vụ.
  // "pending": ngày trong tương lai -> đang chờ.
  completionStatus?: MealCompletionStatus;
  // Số người ăn của ngày này (chỉ có ở danh sách bếp ăn GET /meals/filter và
  // /meals/:id/summary): số cán bộ có suất, số khách đăng ký kèm và tổng cộng.
  // Tính cả suất đã ăn xong (completed); không tính yêu cầu chờ duyệt / đã cắt.
  registeredCount?: number;
  guestCountTotal?: number;
  totalEaters?: number;
};

export type MealFilterParams = {
  from?: string;
  to?: string;
  status?: string;
  isCancelled?: boolean;
  page?: number;
  limit?: number;
};

export type MealSummary = {
  mealId: number;
  mealDate: string;
  totalRegistrations: number;
  totalGuestCount: number;
  totalMealSlots: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

// ===== Đăng ký suất ăn (bảng `meal_registration`) =====

// "completed" = suất ăn đã THỰC SỰ diễn ra (job hoàn thành suất ăn chạy vào
// giờ cấu hình trong Quản lý cấu hình > "Giờ cập nhật hoàn thành suất ăn"
// đã chuyển confirmed -> completed cho ngày này).
export type MealRegistrationStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

// Chỉ có khi status = "pending": người dùng đang XIN GÌ.
//  - "register": xin đăng ký ăn (đăng ký sau giờ chốt). Duyệt -> confirmed,
//    từ chối -> cancelled.
//  - "cancel": xin cắt suất (cắt sau giờ chốt). Duyệt -> cancelled, từ chối
//    -> confirmed (giữ suất ăn).
export type MealRegistrationRequestType = "register" | "cancel";

export type MealRegistration = {
  id: number;
  userId: number;
  userName?: string | null;
  mealId: number;
  mealDate?: string; // YYYY-MM-DD
  guestCount: number;
  status: MealRegistrationStatus;
  requestType?: MealRegistrationRequestType | null;
  createdAt: string;
};

// Trạng thái đăng ký/cắt suất của 1 ngày ăn tại thời điểm hiện tại:
//  - "open": còn trong hạn chốt -> có hiệu lực ngay.
//  - "late": hôm nay, đã qua giờ chốt -> người dùng thường phải chờ duyệt.
//  - "completed" / "past": không thao tác được.
export type RegistrationWindowState = "open" | "late" | "completed" | "past";

// Cửa sổ đăng ký hiện tại do backend tính (giờ VN) - GET /meal-registrations/window.
export type RegistrationWindow = {
  today: string; // YYYY-MM-DD
  nowTime: string; // HH:mm
  closeTime: string | null; // giờ chốt đăng ký, null = không giới hạn
  completionTime: string; // giờ hoàn thành suất ăn
  isPastClose: boolean;
  isPastCompletion: boolean;
  // Ngày mà phần đăng ký/cắt suất đang phục vụ: hôm nay, hoặc NGÀY KẾ TIẾP
  // nếu đã qua giờ hoàn thành suất ăn.
  targetDate: string;
  targetState: RegistrationWindowState;
};

export type MealRegistrationFilterParams = {
  userId?: number;
  mealId?: number;
  status?: string;
  from?: string;
  to?: string;
};

export class MealService {
  constructor(private readonly client = apiClient) {}

  // ----- Meals -----

  async listMeals(): Promise<Meal[]> {
    const res = await this.client.get<ApiResponse<Meal[]>>("/meals");
    return res.payload;
  }

  async filterMeals(params: MealFilterParams): Promise<Meal[]> {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.status) searchParams.set("status", params.status);
    if (params.isCancelled !== undefined)
      searchParams.set("isCancelled", params.isCancelled ? "1" : "0");
    const res = await this.client.get<ApiResponse<Meal[]>>(
      `/meals/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Lọc bếp ăn kèm phân trang
  async filterMealsPaginated(params: MealFilterParams): Promise<PaginatedResponse<Meal>> {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.status) searchParams.set("status", params.status);
    if (params.isCancelled !== undefined)
      searchParams.set("isCancelled", params.isCancelled ? "1" : "0");
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    const res = await this.client.get<ApiResponse<PaginatedResponse<Meal>>>(
      `/meals/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  async getMeal(id: number | string): Promise<Meal> {
    const res = await this.client.get<ApiResponse<Meal>>(`/meals/${id}`);
    return res.payload;
  }

  async getMealSummary(id: number | string): Promise<MealSummary> {
    const res = await this.client.get<ApiResponse<MealSummary>>(
      `/meals/${id}/summary`,
    );
    return res.payload;
  }

  // admin, manager
  async createMeal(payload: {
    mealDate: string;
    note?: string;
  }): Promise<Meal> {
    const res = await this.client.post<ApiResponse<Meal>>("/meals", payload);
    return res.payload;
  }

  async updateMeal(
    id: number | string,
    payload: { note?: string; status?: string },
  ): Promise<Meal> {
    const res = await this.client.put<ApiResponse<Meal>>(
      `/meals/${id}`,
      payload,
    );
    return res.payload;
  }

  async cancelMeal(id: number | string, note?: string): Promise<Meal> {
    const res = await this.client.patch<ApiResponse<Meal>>(
      `/meals/${id}/cancel`,
      { note },
    );
    return res.payload;
  }

  async restoreMeal(id: number | string): Promise<Meal> {
    const res = await this.client.patch<ApiResponse<Meal>>(
      `/meals/${id}/restore`,
    );
    return res.payload;
  }

  async deleteMeal(id: number | string): Promise<void> {
    await this.client.delete<ApiResponse<null>>(`/meals/${id}`);
  }

  // ----- Meal registrations -----

  async listRegistrations(): Promise<MealRegistration[]> {
    const res = await this.client.get<ApiResponse<MealRegistration[]>>(
      "/meal-registrations",
    );
    return res.payload;
  }

  async filterRegistrations(
    params: MealRegistrationFilterParams,
  ): Promise<MealRegistration[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const res = await this.client.get<ApiResponse<MealRegistration[]>>(
      `/meal-registrations/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Lọc đăng ký kèm phân trang
  async filterRegistrationsPaginated(
    params: MealRegistrationFilterParams & { page?: number; limit?: number },
  ): Promise<PaginatedResponse<MealRegistration>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const res = await this.client.get<ApiResponse<PaginatedResponse<MealRegistration>>>(
      `/meal-registrations/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Đăng ký ăn của chính người dùng đang đăng nhập
  async listMyRegistrations(): Promise<MealRegistration[]> {
    const res = await this.client.get<ApiResponse<MealRegistration[]>>(
      "/meal-registrations/me",
    );
    return res.payload;
  }

  async listRegistrationsByMeal(
    mealId: number | string,
  ): Promise<MealRegistration[]> {
    const res = await this.client.get<ApiResponse<MealRegistration[]>>(
      `/meal-registrations/meal/${mealId}`,
    );
    return res.payload;
  }

  // Đăng ký ăn cho chính mình, kèm `guestCount` suất cho khách (tùy chọn).
  // Đăng ký MỚI sau giờ chốt đăng ký của người dùng thường sẽ ở trạng thái
  // "pending" (requestType "register") chờ quản lý/admin duyệt; trong hạn thì
  // "confirmed" ngay. Đổi số khách của đăng ký đang có hiệu lực KHÔNG cần
  // duyệt - quản lý chỉ nhận thông báo để chuẩn bị thêm suất.
  // Chỉ admin/manager mới được truyền userId để đăng ký hộ cho cán bộ khác
  // (backend tự kiểm tra quyền).
  async register(payload: {
    mealId: number;
    guestCount?: number;
    userId?: number;
  }): Promise<MealRegistration> {
    const res = await this.client.post<ApiResponse<MealRegistration>>(
      "/meal-registrations",
      payload,
    );
    return res.payload;
  }

  async updateRegistration(
    id: number | string,
    payload: { guestCount?: number },
  ): Promise<MealRegistration> {
    const res = await this.client.put<ApiResponse<MealRegistration>>(
      `/meal-registrations/${id}`,
      payload,
    );
    return res.payload;
  }

  // Cửa sổ đăng ký hiện tại: giờ chốt, giờ hoàn thành, ngày đang phục vụ đăng ký/cắt suất
  async getRegistrationWindow(): Promise<RegistrationWindow> {
    const res = await this.client.get<ApiResponse<RegistrationWindow>>(
      "/meal-registrations/window",
    );
    return res.payload;
  }

  // Admin/manager DUYỆT yêu cầu đang chờ (đăng ký -> confirmed, cắt suất -> cancelled)
  async approveRegistration(id: number | string): Promise<MealRegistration> {
    const res = await this.client.patch<ApiResponse<MealRegistration>>(
      `/meal-registrations/${id}/approve`,
    );
    return res.payload;
  }

  // Admin/manager TỪ CHỐI yêu cầu đang chờ (đăng ký -> cancelled, cắt suất -> confirmed)
  async rejectRegistration(id: number | string): Promise<MealRegistration> {
    const res = await this.client.patch<ApiResponse<MealRegistration>>(
      `/meal-registrations/${id}/reject`,
    );
    return res.payload;
  }

  /** @deprecated Dùng approveRegistration() - backend tự xử lý theo loại yêu cầu. */
  async confirmRegistration(
    id: number | string,
  ): Promise<MealRegistration> {
    return this.approveRegistration(id);
  }

  // Hủy đăng ký của chính mình (hoặc admin/manager hủy hộ)
  async cancelRegistration(
    id: number | string,
  ): Promise<MealRegistration> {
    const res = await this.client.patch<ApiResponse<MealRegistration>>(
      `/meal-registrations/${id}/cancel`,
    );
    return res.payload;
  }

  /** @deprecated Dùng approveRegistration(). */
  async approveCancelRequest(
    id: number | string,
  ): Promise<MealRegistration> {
    return this.approveRegistration(id);
  }

  /** @deprecated Dùng rejectRegistration(). */
  async rejectCancelRequest(
    id: number | string,
  ): Promise<MealRegistration> {
    return this.rejectRegistration(id);
  }

  async deleteRegistration(id: number | string): Promise<void> {
    await this.client.delete<ApiResponse<null>>(`/meal-registrations/${id}`);
  }

  // Xuất danh sách đăng ký ra Excel
  async exportRegistrations(params: MealRegistrationFilterParams): Promise<void> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    
    const url = `/meal-registrations/export?${searchParams.toString()}`;
    const link = document.createElement("a");
    link.href = `${this.client.getBaseUrl()}${url}`;
    link.click();
  }
}

export const mealService = new MealService();
