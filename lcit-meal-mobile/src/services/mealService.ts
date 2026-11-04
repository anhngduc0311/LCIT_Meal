/**
 * Meal Service
 * Quản lý lịch ăn, đăng ký suất ăn, cắt suất, yêu cầu nghỉ ăn, ngày lễ và quản lý bếp ăn
 */

import { apiClient, extractDataList } from './apiClient';
import { mockStore } from './mockStore';
import { systemSettingService } from './systemSettingService';
import { assertCancellationAllowed, vietnamToday } from '../utils/cancellationDeadline';
import {
  Meal,
  MealRegistration,
  MealOption,
  HolidayEvent,
  MealScheduleConfig,
  RegisterMealRequest,
  CreateMealOptionRequest,
  MealSummaryResponse,
  CreateMealRequest,
  UpdateMealRequest,
  CreateHolidayEventRequest,
  MealRegistrationFilterParams,
  MealOptionFilterParams,
  PaginatedData,
} from '../types';

export const mealService = {
  // ==================== LỊCH BẾP (MEALS) ====================

  /**
   * Lấy danh sách lịch bếp: GET /api/meals
   */
  async getMeals(useMock = false): Promise<Meal[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMeals();
    }
    const res = await apiClient<Meal[] | PaginatedData<Meal>>('/meals');
    return extractDataList<Meal>(res);
  },

  /**
   * Lọc lịch bếp: GET /api/meals/filter?from&to&status&isCancelled
   */
  async filterMeals(
    params: { from?: string; to?: string; status?: string; isCancelled?: boolean | number },
    useMock = false
  ): Promise<Meal[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      let meals = mockStore.getMeals();
      if (params.from) meals = meals.filter((m) => m.mealDate >= params.from!);
      if (params.to) meals = meals.filter((m) => m.mealDate <= params.to!);
      if (params.status) meals = meals.filter((m) => m.status === params.status);
      if (params.isCancelled !== undefined) {
        const isC = Boolean(params.isCancelled);
        meals = meals.filter((m) => Boolean(m.isCancelled) === isC);
      }
      return meals;
    }

    const queryParams = new URLSearchParams();
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);
    if (params.status) queryParams.append('status', params.status);
    if (params.isCancelled !== undefined) queryParams.append('isCancelled', String(params.isCancelled));

    const res = await apiClient<Meal[] | PaginatedData<Meal>>(`/meals/filter?${queryParams.toString()}`);
    return extractDataList<Meal>(res);
  },

  /**
   * Xem chi tiết 1 ngày bếp: GET /api/meals/:id
   */
  async getMealById(id: number, useMock = false): Promise<Meal> {
    if (useMock) {
      const meal = mockStore.getMealById(id);
      if (!meal) throw new Error('Không tìm thấy ngày bếp');
      return meal;
    }
    return await apiClient<Meal>(`/meals/${id}`);
  },

  /**
   * Lấy tổng hợp số suất ăn cần chuẩn bị (Admin/Manager): GET /api/meals/:id/summary
   */
  async getMealSummary(mealId: number, useMock = false): Promise<MealSummaryResponse> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMealSummary(mealId);
    }
    return await apiClient<MealSummaryResponse>(`/meals/${mealId}/summary`);
  },

  /**
   * Tạo ngày bếp mới: POST /api/meals (Admin/Manager)
   */
  async createMeal(data: CreateMealRequest, useMock = false): Promise<Meal> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      return mockStore.createMeal(data.mealDate, data.note, data.status);
    }
    return await apiClient<Meal>('/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Cập nhật thực đơn/ghi chú ngày bếp: PUT /api/meals/:id (Admin/Manager)
   */
  async updateMeal(id: number, data: UpdateMealRequest, useMock = false): Promise<Meal> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const updated = mockStore.updateMeal(id, data);
      if (!updated) throw new Error('Cập nhật ngày bếp thất bại');
      return updated;
    }
    return await apiClient<Meal>(`/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Hủy bếp ăn (tự động thông báo cán bộ): PATCH /api/meals/:id/cancel (Admin/Manager)
   */
  async cancelMeal(id: number, reason?: string, useMock = false): Promise<Meal> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const cancelled = mockStore.cancelMeal(id, reason);
      if (!cancelled) throw new Error('Hủy ngày bếp thất bại');
      return cancelled;
    }
    return await apiClient<Meal>(`/meals/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Mở lại bếp ăn đã hủy nhầm: PATCH /api/meals/:id/restore (Admin/Manager)
   */
  async restoreMeal(id: number, useMock = false): Promise<Meal> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const restored = mockStore.restoreMeal(id);
      if (!restored) throw new Error('Mở lại bếp ăn thất bại');
      return restored;
    }
    return await apiClient<Meal>(`/meals/${id}/restore`, {
      method: 'PATCH',
    });
  },

  /**
   * Xóa ngày bếp: DELETE /api/meals/:id (Admin only)
   */
  async deleteMeal(id: number, useMock = false): Promise<void> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      mockStore.deleteMeal(id);
      return;
    }
    await apiClient(`/meals/${id}`, { method: 'DELETE' });
  },

  // ==================== ĐĂNG KÝ SUẤT ĂN (MEAL REGISTRATIONS) ====================

  /**
   * Lấy danh sách suất ăn cá nhân: GET /api/meal-registrations/me
   */
  async getMyRegistrations(useMock = false): Promise<MealRegistration[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMyRegistrations();
    }
    const res = await apiClient<MealRegistration[] | PaginatedData<MealRegistration>>('/meal-registrations/me');
    return extractDataList<MealRegistration>(res);
  },

  /**
   * Lấy toàn bộ danh sách đăng ký suất ăn (Admin/Manager): GET /api/meal-registrations
   */
  async getAllRegistrations(useMock = false): Promise<MealRegistration[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getAllRegistrations();
    }
    const res = await apiClient<MealRegistration[] | PaginatedData<MealRegistration>>('/meal-registrations');
    return extractDataList<MealRegistration>(res);
  },

  /**
   * Lọc và tìm kiếm danh sách đăng ký (Admin/Manager): GET /api/meal-registrations/filter
   */
  async filterRegistrations(params: MealRegistrationFilterParams, useMock = false): Promise<MealRegistration[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      let list = mockStore.getAllRegistrations();
      if (params.userId) list = list.filter((r) => r.userId === params.userId);
      if (params.mealId) list = list.filter((r) => r.mealId === params.mealId);
      if (params.status) list = list.filter((r) => r.status === params.status);
      if (params.from) list = list.filter((r) => (r.mealDate || '') >= params.from!);
      if (params.to) list = list.filter((r) => (r.mealDate || '') <= params.to!);
      return list;
    }

    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', String(params.userId));
    if (params.mealId) queryParams.append('mealId', String(params.mealId));
    if (params.status) queryParams.append('status', params.status);
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    const res = await apiClient<MealRegistration[] | PaginatedData<MealRegistration>>(
      `/meal-registrations/filter?${queryParams.toString()}`
    );
    return extractDataList<MealRegistration>(res);
  },

  /**
   * Lấy danh sách đăng ký theo ngày bếp cụ thể: GET /api/meal-registrations/meal/:mealId
   */
  async getRegistrationsByMeal(mealId: number, useMock = false): Promise<MealRegistration[]> {
    if (useMock) {
      return mockStore.getAllRegistrations().filter((r) => r.mealId === mealId);
    }
    const res = await apiClient<MealRegistration[] | PaginatedData<MealRegistration>>(
      `/meal-registrations/meal/${mealId}`
    );
    return extractDataList<MealRegistration>(res);
  },

  /**
   * Đăng ký / Đăng ký lại suất ăn (hoặc đăng ký hộ cho cán bộ khác): POST /api/meal-registrations
   */
  async registerMeal(data: RegisterMealRequest, useMock = false): Promise<MealRegistration> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      return mockStore.registerMeal(data.mealId, data.guestCount || 0, data.userId);
    }
    return await apiClient<MealRegistration>('/meal-registrations', {
      method: 'POST',
      body: JSON.stringify({
        mealId: data.mealId,
        guestCount: data.guestCount !== undefined ? data.guestCount : 0,
        userId: data.userId,
      }),
    });
  },

  async getMealGuestCounts(params: { from?: string; to?: string } = {}, useMock = false): Promise<import('../types').MealGuestCount[]> {
    if (useMock) return mockStore.getMealGuestCounts(params.from, params.to);
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    return apiClient<import('../types').MealGuestCount[]>(`/meals/guests?${query}`);
  },

  async removeMealGuests(mealId: number, facilityId: 1 | 2, count: number, useMock = false): Promise<import('../types').MealGuestCount> {
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Số suất khách phải từ 1 đến 1000.');
    if (useMock) return mockStore.removeMealGuests(mealId, facilityId, count);
    return apiClient<import('../types').MealGuestCount>(`/meals/${mealId}/guests/remove`, { method: 'PATCH', body: JSON.stringify({ facilityId, count }) });
  },

  async addMealGuests(mealId: number, facilityId: 1 | 2, count: number, useMock = false): Promise<import('../types').MealGuestCount> {
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Số suất khách phải từ 1 đến 1000.');
    if (useMock) return mockStore.addMealGuests(mealId, facilityId, count);
    return apiClient<import('../types').MealGuestCount>(`/meals/${mealId}/guests`, { method: 'PATCH', body: JSON.stringify({ facilityId, count }) });
  },

  /**
   * Cập nhật số lượng khách: PUT /api/meal-registrations/:id
   */
  async updateGuestCount(
    mealId: number,
    guestCount: number,
    registrationId?: number,
    useMock = false
  ): Promise<MealRegistration> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.updateGuestCount(mealId, guestCount);
    }

    if (registrationId) {
      return await apiClient<MealRegistration>(`/meal-registrations/${registrationId}`, {
        method: 'PUT',
        body: JSON.stringify({ guestCount }),
      });
    }

    return await apiClient<MealRegistration>('/meal-registrations', {
      method: 'POST',
      body: JSON.stringify({ mealId, guestCount }),
    });
  },

  /**
   * Cắt suất trực tiếp: PATCH /api/meal-registrations/:id/cancel
   */
  // Management adjustments rely on server role checks and have no time limit.
  async cancelRegistrationOnBehalf(registrationId: number, useMock = false): Promise<MealRegistration> {
    if (useMock) {
      const record = mockStore.getAllRegistrations().find(item => item.id === registrationId);
      if (!record) throw new Error('Không tìm thấy suất ăn.');
      if (record.status === 'cancelled') throw new Error('Suất ăn đã được cắt.');
      return mockStore.cancelMealRegistration(registrationId)!;
    }
    return apiClient<MealRegistration>(`/meal-registrations/${registrationId}/cancel`, {
      method: 'PATCH',
    });
  },

  async cancelRegistration(
    registrationId: number,
    reason?: string,
    useMock = false
  ): Promise<MealRegistration> {
    // Resolve the actual meal date and recheck immediately before the write, even
    // if the confirmation dialog was opened before 08:00.
    const registration = useMock
      ? mockStore.getAllRegistrations().find(record => record.id === registrationId)
      : await apiClient<MealRegistration>(`/meal-registrations/${registrationId}`);
    if (!registration) throw new Error('Không tìm thấy suất ăn để cắt.');
    assertCancellationAllowed(registration.mealDate || registration.meal?.mealDate);
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      assertCancellationAllowed(registration.mealDate || registration.meal?.mealDate);
      const res = mockStore.cancelMealRegistration(registrationId);
      if (!res) throw new Error('Không tìm thấy suất ăn để cắt.');
      return res;
    }
    return await apiClient<MealRegistration>(`/meal-registrations/${registrationId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Duyệt yêu cầu cắt trực tiếp (PENDING -> CANCELLED): PATCH /api/meal-registrations/:id/approve-cancel (Admin/Manager)
   */
  async approveCancelRegistration(id: number, useMock = false): Promise<MealRegistration> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.approveCancelRegistration(id);
      if (!res) throw new Error('Thao tác duyệt thất bại');
      return res;
    }
    return await apiClient<MealRegistration>(`/meal-registrations/${id}/approve-cancel`, {
      method: 'PATCH',
    });
  },

  /**
   * Từ chối yêu cầu cắt trực tiếp (PENDING -> CONFIRMED): PATCH /api/meal-registrations/:id/reject-cancel (Admin/Manager)
   */
  async rejectCancelRegistration(id: number, useMock = false): Promise<MealRegistration> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.rejectCancelRegistration(id);
      if (!res) throw new Error('Thao tác từ chối thất bại');
      return res;
    }
    return await apiClient<MealRegistration>(`/meal-registrations/${id}/reject-cancel`, {
      method: 'PATCH',
    });
  },

  /**
   * Xác nhận đăng ký: PATCH /api/meal-registrations/:id/confirm (Admin/Manager)
   */
  async confirmRegistration(id: number, useMock = false): Promise<MealRegistration> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.confirmRegistration(id);
      if (!res) throw new Error('Xác nhận đăng ký thất bại');
      return res;
    }
    return await apiClient<MealRegistration>(`/meal-registrations/${id}/confirm`, {
      method: 'PATCH',
    });
  },

  /**
   * Xóa đăng ký: DELETE /api/meal-registrations/:id (Admin/Manager)
   */
  async deleteRegistration(id: number, useMock = false): Promise<void> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      mockStore.deleteRegistration(id);
      return;
    }
    await apiClient(`/meal-registrations/${id}`, { method: 'DELETE' });
  },

  // ==================== YÊU CẦU CẮT SUẤT (MEAL OPTIONS) ====================

  /**
   * Lấy danh sách yêu cầu cắt suất cá nhân: GET /api/meal-options/me
   */
  async getMyMealOptions(useMock = false): Promise<MealOption[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMyMealOptions();
    }
    const res = await apiClient<MealOption[] | PaginatedData<MealOption>>('/meal-options/me');
    return extractDataList<MealOption>(res);
  },

  /**
   * Lấy toàn bộ danh sách yêu cầu cắt suất (Admin/Manager): GET /api/meal-options
   */
  async getAllMealOptions(useMock = false): Promise<MealOption[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getAllMealOptions();
    }
    const res = await apiClient<MealOption[] | PaginatedData<MealOption>>('/meal-options');
    return extractDataList<MealOption>(res);
  },

  /**
   * Lọc yêu cầu cắt suất (Admin/Manager): GET /api/meal-options/filter
   */
  async filterMealOptions(params: MealOptionFilterParams, useMock = false): Promise<MealOption[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      let list = mockStore.getAllMealOptions();
      if (params.userId) list = list.filter((o) => o.userId === params.userId);
      if (params.type) list = list.filter((o) => o.type === params.type);
      if (params.status) list = list.filter((o) => o.status === params.status);
      return list;
    }

    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', String(params.userId));
    if (params.type) queryParams.append('type', params.type);
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    const res = await apiClient<MealOption[] | PaginatedData<MealOption>>(
      `/meal-options/filter?${queryParams.toString()}`
    );
    return extractDataList<MealOption>(res);
  },

  /**
   * Tạo yêu cầu cắt suất: POST /api/meal-options
   */
  async createMealOption(data: CreateMealOptionRequest, useMock = false): Promise<MealOption> {
    // A range or permanent request may not cancel today's already locked meal.
    assertCancellationAllowed(data.fromDate);
    if (data.type === 'cancel_today') assertCancellationAllowed(vietnamToday());
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      assertCancellationAllowed(data.type === 'cancel_today' ? vietnamToday() : data.fromDate);
      return mockStore.createMealOption(data.type, data.fromDate, data.toDate, data.note, data.userId);
    }
    return await apiClient<MealOption>('/meal-options', {
      method: 'POST',
      body: JSON.stringify({
        type: data.type,
        fromDate: data.fromDate,
        toDate: data.toDate,
        note: data.note || null,
        userId: data.userId,
      }),
    });
  },

  /**
   * Duyệt yêu cầu cắt suất (Admin/Manager): PATCH /api/meal-options/:id/approve
   */
  async approveMealOption(id: number, useMock = false): Promise<MealOption> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.approveMealOption(id);
      if (!res) throw new Error('Duyệt yêu cầu thất bại');
      return res;
    }
    return await apiClient<MealOption>(`/meal-options/${id}/approve`, {
      method: 'PATCH',
    });
  },

  /**
   * Từ chối yêu cầu cắt suất (Admin/Manager): PATCH /api/meal-options/:id/reject
   */
  async rejectMealOption(id: number, useMock = false): Promise<MealOption> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.rejectMealOption(id);
      if (!res) throw new Error('Từ chối yêu cầu thất bại');
      return res;
    }
    return await apiClient<MealOption>(`/meal-options/${id}/reject`, {
      method: 'PATCH',
    });
  },

  /**
   * Hủy yêu cầu cắt suất: DELETE /api/meal-options/:id
   */
  async deleteMealOption(id: number, useMock = false): Promise<void> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      mockStore.deleteMealOption(id);
      return;
    }
    await apiClient(`/meal-options/${id}`, { method: 'DELETE' });
  },

  async reactivateMealOption(id: number, fromDate: string, useMock = false): Promise<{ fromDate: string; restoredCount: number }> {
    if (useMock) return mockStore.reactivateMealOption(id, fromDate);
    return apiClient(`/meal-options/${id}/reactivate`, { method: 'PATCH', body: JSON.stringify({ fromDate }) });
  },

  // ==================== LỊCH NGHỈ LỄ (HOLIDAY EVENTS) ====================

  /**
   * Lấy danh sách ngày lễ: GET /api/holiday-events
   */
  async getHolidays(useMock = false): Promise<HolidayEvent[]> {
    if (useMock) {
      return mockStore.getHolidays();
    }
    const res = await apiClient<HolidayEvent[] | PaginatedData<HolidayEvent>>('/holiday-events');
    return extractDataList<HolidayEvent>(res);
  },

  /**
   * Tạo sự kiện nghỉ lễ/Tết (Admin/Manager): POST /api/holiday-events
   */
  async createHoliday(data: CreateHolidayEventRequest, useMock = false): Promise<HolidayEvent> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      return mockStore.createHoliday(data);
    }
    return await apiClient<HolidayEvent>('/holiday-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Mở lại sự kiện nghỉ đã xóa/hủy: PATCH /api/holiday-events/:id/restore (Admin/Manager)
   */
  async restoreHoliday(id: number, useMock = false): Promise<HolidayEvent> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const res = mockStore.restoreHoliday(id);
      if (!res) throw new Error('Mở lại sự kiện nghỉ thất bại');
      return res;
    }
    return await apiClient<HolidayEvent>(`/holiday-events/${id}/restore`, {
      method: 'PATCH',
    });
  },

  /**
   * Lấy cấu hình lịch ăn: GET /api/system-settings/meal-schedule-config
   */
  async getScheduleConfig(useMock = false): Promise<MealScheduleConfig> {
    return await systemSettingService.getAggregatedConfig(useMock);
  },
};
