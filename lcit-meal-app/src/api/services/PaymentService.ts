import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";
import type { PaginatedResponse } from "../types/Pagination";

export type PaymentStatus = "unpaid" | "paid" | "overdue";

export type Payment = {
  id: number;
  userId: number;
  paymentDate: string;
  amount: number;
  isPaid: 0 | 1;
  paidAt: string | null;
  paidAmount: number | null;
  billImg: string | null;
  status: PaymentStatus;
};

// Bộ lọc lịch sử thanh toán cá nhân: tất cả / đã thanh toán / chưa thanh toán
// (chưa thanh toán gồm cả kỳ quá hạn).
export type MyPaymentStatusFilter = "all" | "paid" | "unpaid";

export type MyPaymentListParams = {
  status?: MyPaymentStatusFilter;
  page?: number;
  limit?: number;
};

// Số suất + tiền của 1 tháng. CHỈ tính suất ĐÃ ĂN - suất sắp ăn (đã đăng ký
// nhưng chưa diễn ra) không được tính.
export type MonthPaymentSummary = {
  month: string; // YYYY-MM
  from: string;
  to: string;
  mealCount: number; // suất của chính người dùng
  guestCount: number; // suất khách
  totalSlots: number;
  mealAmount: number;
  guestAmount: number;
  totalAmount: number;
  isClosed: boolean; // tháng đã kết thúc (đã tới kỳ thanh toán)
};

// Tóm tắt thanh toán cá nhân (GET /payments/me/summary), theo nguyên tắc
// "hết tháng mới tính thanh toán":
//  - payableMonth: THÁNG VỪA KẾT THÚC - kỳ đang phải thanh toán, kèm hóa đơn
//    của kỳ đó nếu quản lý đã lập (null nếu chưa).
//  - currentMonth: THÁNG HIỆN TẠI - chỉ là số tạm tính đến hôm nay, chưa phải
//    thanh toán, được chốt khi hết tháng (`closesOn`).
export type MyPaymentSummary = {
  mealPrice: number;
  guestMealPrice: number;
  outstanding: { count: number; amount: number }; // tổng các kỳ chưa thanh toán
  currentMonth: MonthPaymentSummary & { closesOn: string };
  payableMonth: MonthPaymentSummary & { payment: Payment | null };
};

export type PaymentFilterParams = {
  userId?: number;
  status?: string;
  from?: string;
  to?: string;
};

export type CreatePaymentRequest = {
  userId: number;
  paymentDate: string;
  amount: number;
  status?: PaymentStatus;
};

export class PaymentService {
  constructor(private readonly client = apiClient) {}

  // admin, manager
  async list(): Promise<Payment[]> {
    const res = await this.client.get<ApiResponse<Payment[]>>("/payments");
    return res.payload;
  }

  async filter(params: PaymentFilterParams): Promise<Payment[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const res = await this.client.get<ApiResponse<Payment[]>>(
      `/payments/filter?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Lịch sử thanh toán của chính người dùng đang đăng nhập
  async listMine(): Promise<Payment[]> {
    const res = await this.client.get<ApiResponse<Payment[]>>(
      "/payments/me",
    );
    return res.payload;
  }

  // Lịch sử thanh toán của chính mình, có lọc trạng thái + phân trang
  async listMinePaginated(
    params: MyPaymentListParams = {},
  ): Promise<PaginatedResponse<Payment>> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));
    const res = await this.client.get<ApiResponse<PaginatedResponse<Payment>>>(
      `/payments/me?${searchParams.toString()}`,
    );
    return res.payload;
  }

  // Tiền phải trả (tháng vừa kết thúc) + số tạm tính tháng hiện tại
  async getMySummary(): Promise<MyPaymentSummary> {
    const res = await this.client.get<ApiResponse<MyPaymentSummary>>(
      "/payments/me/summary",
    );
    return res.payload;
  }

  async getById(id: number | string): Promise<Payment> {
    const res = await this.client.get<ApiResponse<Payment>>(
      `/payments/${id}`,
    );
    return res.payload;
  }

  async create(payload: CreatePaymentRequest): Promise<Payment> {
    const res = await this.client.post<ApiResponse<Payment>>(
      "/payments",
      payload,
    );
    return res.payload;
  }

  async update(
    id: number | string,
    payload: Partial<CreatePaymentRequest>,
  ): Promise<Payment> {
    const res = await this.client.put<ApiResponse<Payment>>(
      `/payments/${id}`,
      payload,
    );
    return res.payload;
  }

  async markPaid(
    id: number | string,
    payload?: { paidAmount?: number; billImg?: string },
  ): Promise<Payment> {
    const res = await this.client.patch<ApiResponse<Payment>>(
      `/payments/${id}/mark-paid`,
      payload,
    );
    return res.payload;
  }

  async remove(id: number | string): Promise<void> {
    await this.client.delete<ApiResponse<null>>(`/payments/${id}`);
  }
}

export const paymentService = new PaymentService();
