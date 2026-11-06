import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

export type MealOptionType =
  | "cancel_today"
  | "cancel_schedule"
  | "cancel_permanent";

export type MealOptionStatus = "pending" | "approved" | "rejected";

export type MealOption = {
  id: number;
  userId: number;
  userName?: string | null;
  type: MealOptionType;
  fromDate: string;
  toDate: string;
  note: string | null;
  status: MealOptionStatus;
  createdAt: string;
  createdBy: number | null;
  updatedAt: string | null;
  updatedBy: number | null;
  approvedAt: string | null;
  approvedBy: number | null;
};

export type MealOptionFilterParams = {
  userId?: number;
  type?: string;
  status?: string;
};

export type CreateMealOptionRequest = {
  type: MealOptionType;
  fromDate: string;
  toDate: string;
  note?: string;
};

export class MealOptionService {
  constructor(private readonly client = apiClient) {}

  async list(): Promise<MealOption[]> {
    const res =
      await this.client.get<ApiResponse<MealOption[]>>("/meal-options");
    return res.payload;
  }

  async filter(params: MealOptionFilterParams): Promise<MealOption[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const res = await this.client.get<ApiResponse<MealOption[]>>(
      `/meal-options/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Yêu cầu hủy ăn của chính người dùng đang đăng nhập
  async listMine(): Promise<MealOption[]> {
    const res =
      await this.client.get<ApiResponse<MealOption[]>>("/meal-options/me");
    return res.payload;
  }

  async getById(id: number | string): Promise<MealOption> {
    const res = await this.client.get<ApiResponse<MealOption>>(
      `/meal-options/${id}`,
    );
    return res.payload;
  }

  // Tạo yêu cầu hủy ăn cho chính mình. "cancel_today" được tự động duyệt,
  // các loại còn lại ở trạng thái "pending" chờ admin/manager duyệt.
  async create(payload: CreateMealOptionRequest): Promise<MealOption> {
    const res = await this.client.post<ApiResponse<MealOption>>(
      "/meal-options",
      payload,
    );
    return res.payload;
  }

  async update(
    id: number | string,
    payload: Partial<CreateMealOptionRequest>,
  ): Promise<MealOption> {
    const res = await this.client.put<ApiResponse<MealOption>>(
      `/meal-options/${id}`,
      payload,
    );
    return res.payload;
  }

  async approve(id: number | string): Promise<MealOption> {
    const res = await this.client.patch<ApiResponse<MealOption>>(
      `/meal-options/${id}/approve`,
    );
    return res.payload;
  }

  async reject(id: number | string, note?: string): Promise<MealOption> {
    const res = await this.client.patch<ApiResponse<MealOption>>(
      `/meal-options/${id}/reject`,
      note ? { note } : undefined,
    );
    return res.payload;
  }

  // "Xác nhận đăng ký ăn lại" - kết thúc sớm 1 yêu cầu cắt suất vĩnh
  // viễn/theo khoảng ngày đã duyệt, để user có thể đăng ký ăn lại.
  async reactivate(id: number | string): Promise<MealOption> {
    const res = await this.client.patch<ApiResponse<MealOption>>(
      `/meal-options/${id}/reactivate`,
    );
    return res.payload;
  }

  async remove(id: number | string): Promise<void> {
    await this.client.delete<ApiResponse<null>>(`/meal-options/${id}`);
  }
}

export const mealOptionService = new MealOptionService();
