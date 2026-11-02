/**
 * Payment Service
 * Quản lý các khoản thanh toán cá nhân và quản trị thanh toán toàn cơ quan
 * TUÂN THỦ GAP-01: Chỉ truy vấn /payments/me cho nhân viên, không tính tổng toàn cơ quan cho employee.
 */

import { apiClient, extractDataList } from './apiClient';
import { mockStore } from './mockStore';
import {
  Payment,
  PaymentSummary,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  MarkPaidRequest,
  PaymentFilterParams,
  PaginatedData,
  MealLedger,
} from '../types';

export const paymentService = {
  async getMyMealLedger(useMock = false): Promise<MealLedger> {
    if (useMock) {
      const payments = await this.getMyPayments(true);
      const totalUnpaidAmount = payments.filter(p => !p.isPaid && p.status !== 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
      return { currentMonth: new Date().toISOString().slice(0, 7), months: [], totalUnpaidAmount, unpaidCount: payments.filter(p => !p.isPaid && p.status !== 'paid').length, overdueCount: 0 };
    }
    const result = await apiClient<Omit<MealLedger, 'overdueCount'>>('/payments/me/ledger');
    return { ...result, overdueCount: 0 };
  },
  /**
   * Lấy danh sách thanh toán của tôi: GET /api/payments/me
   */
  async getMyPayments(useMock = false): Promise<Payment[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMyPayments();
    }
    const res = await apiClient<Payment[] | PaginatedData<Payment>>('/payments/me');
    return extractDataList<Payment>(res);
  },

  /**
   * Tính toán tóm tắt thanh toán cá nhân từ /payments/me
   */
  async getMyPaymentSummary(useMock = false): Promise<PaymentSummary> {
    if (!useMock) return this.getMyMealLedger(false);
    const payments = await this.getMyPayments(useMock);

    let totalUnpaidAmount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;
    let latestPaymentDate: string | undefined = undefined;

    for (const p of payments) {
      const isPaid = p.status === 'paid' || p.isPaid === 1 || p.isPaid === true;
      if (!isPaid) {
        totalUnpaidAmount += Number(p.amount) || 0;
        unpaidCount += 1;
        if (p.status === 'overdue') {
          overdueCount += 1;
        }
      }
      if (!latestPaymentDate || (p.paymentDate && p.paymentDate > latestPaymentDate)) {
        latestPaymentDate = p.paymentDate;
      }
    }

    return {
      totalUnpaidAmount,
      unpaidCount,
      overdueCount,
      latestPaymentDate,
    };
  },

  /**
   * Lấy toàn bộ danh sách thanh toán (Admin/Manager): GET /api/payments
   */
  async getAllPayments(useMock = false): Promise<Payment[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getAllPayments();
    }
    const res = await apiClient<Payment[] | PaginatedData<Payment>>('/payments');
    return extractDataList<Payment>(res);
  },

  /**
   * Lọc và tìm kiếm danh sách thanh toán (Admin/Manager): GET /api/payments/filter
   */
  async filterPayments(params: PaymentFilterParams, useMock = false): Promise<Payment[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      let list = mockStore.getAllPayments();
      if (params.userId) list = list.filter((p) => p.userId === params.userId);
      if (params.status) list = list.filter((p) => p.status === params.status);
      if (params.from) list = list.filter((p) => p.paymentDate >= params.from!);
      if (params.to) list = list.filter((p) => p.paymentDate <= params.to!);
      return list;
    }

    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', String(params.userId));
    if (params.status) queryParams.append('status', params.status);
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    const res = await apiClient<Payment[] | PaginatedData<Payment>>(
      `/payments/filter?${queryParams.toString()}`
    );
    return extractDataList<Payment>(res);
  },

  /**
   * Xem chi tiết một khoản thanh toán: GET /api/payments/:id (Admin/Manager)
   */
  async getPayment(id: number, useMock = false): Promise<Payment> {
    if (useMock) {
      const p = mockStore.getAllPayments().find((x) => x.id === id);
      if (!p) throw new Error('Không tìm thấy khoản thanh toán');
      return p;
    }
    return await apiClient<Payment>(`/payments/${id}`);
  },

  /**
   * Tạo khoản thanh toán thủ công (Admin/Manager): POST /api/payments
   */
  async createPayment(data: CreatePaymentRequest, useMock = false): Promise<Payment> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      return mockStore.createPayment(data);
    }
    return await apiClient<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Cập nhật khoản thanh toán (Admin/Manager): PUT /api/payments/:id
   */
  async updatePayment(id: number, data: UpdatePaymentRequest, useMock = false): Promise<Payment> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const updated = mockStore.updatePayment(id, data);
      if (!updated) throw new Error('Cập nhật khoản thanh toán thất bại');
      return updated;
    }
    return await apiClient<Payment>(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Đánh dấu đã thanh toán (Admin/Manager): PATCH /api/payments/:id/mark-paid
   * Chỉ gửi paidAmount và billImg dạng chuỗi URL/mã tham chiếu theo API thực tế
   */
  async markPaid(id: number, data: MarkPaidRequest = {}, useMock = false): Promise<Payment> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const marked = mockStore.markPaymentPaid(id, data.paidAmount, data.billImg);
      if (!marked) throw new Error('Xác nhận thanh toán thất bại');
      return marked;
    }
    return await apiClient<Payment>(`/payments/${id}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Xóa khoản thanh toán (Admin only): DELETE /api/payments/:id
   */
  async deletePayment(id: number, useMock = false): Promise<void> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      mockStore.deletePayment(id);
      return;
    }
    await apiClient(`/payments/${id}`, { method: 'DELETE' });
  },
};
