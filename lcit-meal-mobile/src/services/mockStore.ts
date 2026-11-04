import { formatBusinessDate } from '../utils/formatters';
import { getFacility, type FacilityFilter } from '../utils/facilities';
/**
 * Mock Store
 * Quản lý trạng thái dữ liệu mẫu trong bộ nhớ khi chạy chế độ Mock
 * Đầy đủ tính năng quản lý và quản trị viên cho Giai đoạn 4.
 */

import {
  User,
  MealGuestCount,
  Meal,
  MealRegistration,
  MealOption,
  Payment,
  NotificationItem,
  HolidayEvent,
  MealScheduleConfig,
  MealScheduleDayConfig,
  MealScheduleConfigResponse,
  SystemSettingItem,
  MealOptionType,
  DashboardHomeData,
  DashboardChartResponse,
  MealSummaryResponse,
  CreateUserRequest,
  UpdateUserRequest,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  SendNotificationRequest,
  CreateHolidayEventRequest,
  AuditLogItem,
} from '../types';
import {
  mockUsers,
  mockMeals,
  mockRegistrations,
  mockMealOptions,
  mockPayments,
  mockNotifications,
  mockHolidays,
  mockScheduleConfig,
} from '../mocks/fixtures';

class MockStore {
  private mealGuestCounts: MealGuestCount[] = [];
  removeMealGuests(mealId: number, facilityId: 1 | 2, count: number): MealGuestCount {
    const meal = this.meals.find(item => item.id === mealId && !item.isCancelled && item.status === 'active');
    if (!meal) throw new Error('Bếp không phục vụ ngày này.');
    const item = this.mealGuestCounts.find(item => item.mealId === mealId && item.facilityId === facilityId);
    if (!Number.isInteger(count) || count < 1 || count > 1000 || !item || item.guestCount < count) throw new Error('Không đủ suất khách để bỏ. Vui lòng tải lại.');
    item.guestCount -= count;
    this.notify();
    return { ...item };
  }
  getMealGuestCounts(from?: string, to?: string): MealGuestCount[] {
    return this.mealGuestCounts.filter(item => (!from || item.mealDate >= from) && (!to || item.mealDate <= to)
      && this.meals.some(meal => meal.id === item.mealId && !meal.isCancelled && meal.status === 'active'));
  }
  addMealGuests(mealId: number, facilityId: 1 | 2, count: number): MealGuestCount {
    const meal = this.meals.find(item => item.id === mealId && !item.isCancelled && item.status === 'active');
    if (!meal) throw new Error('Bếp không phục vụ ngày này.');
    let item = this.mealGuestCounts.find(item => item.mealId === mealId && item.facilityId === facilityId);
    if (!item) { item = { mealId, mealDate: meal.mealDate, facilityId, guestCount: 0 }; this.mealGuestCounts.push(item); }
    item.guestCount += count;
    this.notify();
    return { ...item };
  }
  private users: User[] = [...mockUsers];
  private meals: Meal[] = [...mockMeals];
  private registrations: MealRegistration[] = [...mockRegistrations];
  private mealOptions: MealOption[] = [...mockMealOptions];
  private payments: Payment[] = [...mockPayments];
  private notifications: NotificationItem[] = [...mockNotifications];
  private holidays: HolidayEvent[] = [...mockHolidays];
  private scheduleConfig: MealScheduleConfig = { ...mockScheduleConfig };
  private currentUserId: number = 1; // Default to An (employee)

  private auditLogs: AuditLogItem[] = [
    {
      id: 1,
      logActor: 3,
      actorName: 'Quản Trị Hệ Thống',
      actorUsername: 'admin',
      logAction: 'create',
      logTarget: 'meal:108',
      logResult: 'success',
      logDetail: 'Tạo lịch bếp ăn ngày 2026-09-25',
      ipAddress: '192.168.1.100',
      userAgent: 'LCIT-Mobile-App/1.0',
      createdAt: '2026-09-25 08:30:15',
    },
    {
      id: 2,
      logActor: 2,
      actorName: 'Trần Quang Minh',
      actorUsername: 'ql_minh',
      logAction: 'approve_cancel',
      logTarget: 'meal_registration:204',
      logResult: 'success',
      logDetail: 'Duyệt yêu cầu cắt suất trực tiếp cán bộ Nguyễn Văn An',
      ipAddress: '192.168.1.105',
      userAgent: 'LCIT-Mobile-App/1.0',
      createdAt: '2026-09-24 10:15:22',
    },
    {
      id: 3,
      logActor: 3,
      actorName: 'Quản Trị Hệ Thống',
      actorUsername: 'admin',
      logAction: 'mark_paid',
      logTarget: 'payment:302',
      logResult: 'success',
      logDetail: 'Xác nhận thanh toán tiền ăn kỳ 2026-08',
      ipAddress: '192.168.1.100',
      userAgent: 'LCIT-Mobile-App/1.0',
      createdAt: '2026-09-23 15:45:00',
    },
    {
      id: 4,
      logActor: 3,
      actorName: 'Quản Trị Hệ Thống',
      actorUsername: 'admin',
      logAction: 'update_setting',
      logTarget: 'system_setting:registration_close_time',
      logResult: 'success',
      logDetail: 'Cập nhật giờ đóng đăng ký thành 08:00',
      ipAddress: '192.168.1.100',
      userAgent: 'LCIT-Mobile-App/1.0',
      createdAt: '2026-09-22 08:00:00',
    },
  ];

  private dayConfigs: MealScheduleDayConfig[] = [
    { dayOfWeek: 0, isEnabled: false, notes: 'Chủ nhật không nấu' },
    { dayOfWeek: 1, isEnabled: true, notes: 'Bữa trưa đầu tuần' },
    { dayOfWeek: 2, isEnabled: true, notes: 'Bữa trưa thứ 3' },
    { dayOfWeek: 3, isEnabled: true, notes: 'Bữa trưa thứ 4' },
    { dayOfWeek: 4, isEnabled: true, notes: 'Bữa trưa thứ 5' },
    { dayOfWeek: 5, isEnabled: true, notes: 'Bữa trưa thứ 6' },
    { dayOfWeek: 6, isEnabled: false, notes: 'Thứ 7 nghỉ' },
  ];

  // Subscriptions for state changes
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private log(action: string, target: string, detail: string, oldData?: unknown, newData?: unknown) {
    const actor = this.getCurrentUser();
    this.auditLogs.unshift({
      id: Date.now(),
      logActor: actor.id,
      actorName: actor.fullName,
      actorUsername: actor.username,
      logAction: action,
      logTarget: target,
      logResult: 'success',
      logDetail: detail,
      ipAddress: '127.0.0.1',
      userAgent: 'LCIT-Mobile-App/1.0 (Demo)',
      oldData,
      newData,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  // ==================== USERS & AUTH ====================
  getCurrentUser(): User {
    return this.users.find((u) => u.id === this.currentUserId) || this.users[0];
  }

  setCurrentUser(userId: number) {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      this.currentUserId = userId;
      this.notify();
    }
  }

  getAllUsers(): User[] {
    return [...this.users];
  }

  createUser(data: CreateUserRequest): User {
    const newId = Date.now();
    const newUser: User = {
      id: newId,
      username: data.username,
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      status: data.status !== undefined ? data.status : 'active',
      role: (data.roleId === 1 ? 'admin' : data.roleId === 2 ? 'manager' : data.roleId === 4 ? 'kitchen' : 'employee'),
      roles: [(data.roleId === 1 ? 'admin' : data.roleId === 2 ? 'manager' : data.roleId === 4 ? 'kitchen' : 'employee')],
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.log('create_user', `user:${newId}`, `Tạo người dùng ${newUser.fullName} (${newUser.username})`);
    this.notify();
    return newUser;
  }

  updateUser(id: number, data: UpdateUserRequest): User | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    const old = { ...user };
    if (data.fullName) user.fullName = data.fullName;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.status !== undefined) user.status = data.status;
    if (data.roleId !== undefined) {
      const role = data.roleId === 1 ? 'admin' : data.roleId === 2 ? 'manager' : data.roleId === 4 ? 'kitchen' : 'employee';
      user.role = role;
      user.roles = [role];
    }
    user.updatedAt = new Date().toISOString();
    this.log('update_user', `user:${id}`, `Cập nhật người dùng ${user.fullName}`, old, user);
    this.notify();
    return user;
  }

  deleteUser(id: number): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    const deleted = this.users[idx];
    this.users.splice(idx, 1);
    this.log('delete_user', `user:${id}`, `Xóa người dùng ${deleted.fullName}`);
    this.notify();
    return true;
  }

  // ==================== MEALS & CALENDAR ====================
  getMeals(): Meal[] {
    return [...this.meals];
  }

  getMealById(id: number): Meal | undefined {
    return this.meals.find((m) => m.id === id);
  }

  createMeal(mealDate: string, note?: string, status = 'active'): Meal {
    const newMeal: Meal = {
      id: Date.now(),
      mealDate,
      note: note || null,
      status,
      isCancelled: false,
      createdAt: new Date().toISOString(),
    };
    this.meals.push(newMeal);
    this.meals.sort((a, b) => a.mealDate.localeCompare(b.mealDate));
    this.log('create_meal', `meal:${newMeal.id}`, `Tạo ngày bếp ăn ${mealDate}`);
    this.notify();
    return newMeal;
  }

  updateMeal(id: number, data: { mealDate?: string; note?: string; status?: string }): Meal | null {
    const meal = this.meals.find((m) => m.id === id);
    if (!meal) return null;
    if (data.mealDate) meal.mealDate = data.mealDate;
    if (data.note !== undefined) meal.note = data.note;
    if (data.status) meal.status = data.status;
    meal.updatedAt = new Date().toISOString();
    this.log('update_meal', `meal:${id}`, `Sửa ngày bếp ăn ${meal.mealDate}`);
    this.notify();
    return meal;
  }

  cancelMeal(id: number, reason?: string): Meal | null {
    const meal = this.meals.find((m) => m.id === id);
    if (!meal) return null;
    meal.isCancelled = true;
    meal.status = 'cancelled';
    meal.note = reason ? `Hủy bếp: ${reason}` : 'Hủy bếp đột xuất';
    meal.cancelledBy = this.currentUserId;
    this.log('cancel_meal', `meal:${id}`, `Hủy bếp ngày ${meal.mealDate}: ${reason || 'Không lý do'}`);
    this.notify();
    return meal;
  }

  restoreMeal(id: number): Meal | null {
    const meal = this.meals.find((m) => m.id === id);
    if (!meal) return null;
    meal.isCancelled = false;
    meal.status = 'active';
    this.log('restore_meal', `meal:${id}`, `Mở lại bếp ăn ngày ${meal.mealDate}`);
    this.notify();
    return meal;
  }

  deleteMeal(id: number): boolean {
    const idx = this.meals.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    const deleted = this.meals[idx];
    this.meals.splice(idx, 1);
    this.log('delete_meal', `meal:${id}`, `Xóa ngày bếp ${deleted.mealDate}`);
    this.notify();
    return true;
  }

  getMealSummary(mealId: number): MealSummaryResponse {
    const meal = this.getMealById(mealId) || {
      id: mealId,
      mealDate: '2026-09-25',
      isCancelled: false,
      status: 'active',
    };
    const regs = this.registrations.filter((r) => r.mealId === mealId && r.status === 'confirmed');
    const totalGuests = regs.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const totalRegistrations = regs.length;
    const totalMealSlots = totalRegistrations + totalGuests;

    return {
      meal,
      totalRegistrations,
      totalGuests,
      totalMealSlots,
    };
  }

  // ==================== HOLIDAYS ====================
  getHolidays(): HolidayEvent[] {
    return [...this.holidays];
  }

  createHoliday(data: CreateHolidayEventRequest): HolidayEvent {
    const newHoliday: HolidayEvent = {
      id: Date.now(),
      name: data.name,
      fromDate: data.fromDate,
      toDate: data.toDate,
      reason: data.reason || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.holidays.push(newHoliday);
    this.log('create_holiday', `holiday:${newHoliday.id}`, `Tạo sự kiện nghỉ lễ: ${data.name}`);
    this.notify();
    return newHoliday;
  }

  restoreHoliday(id: number): HolidayEvent | null {
    const h = this.holidays.find((x) => x.id === id);
    if (!h) return null;
    h.status = 'active';
    this.log('restore_holiday', `holiday:${id}`, `Mở lại sự kiện nghỉ lễ: ${h.name}`);
    this.notify();
    return h;
  }

  // ==================== REGISTRATIONS ====================
  getAllRegistrations(): MealRegistration[] {
    return this.registrations.map((r) => {
      const meal = this.meals.find((m) => m.id === r.mealId);
      const user = this.users.find((u) => u.id === r.userId);
      return {
        ...r,
        meal,
        mealDate: meal?.mealDate || r.mealDate,
        user: user ? { id: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone } : undefined,
      };
    });
  }

  getMyRegistrations(userId = this.currentUserId): MealRegistration[] {
    return this.getAllRegistrations().filter((r) => r.userId === userId);
  }

  registerMeal(mealId: number, guestCount = 0, userId = this.currentUserId): MealRegistration {
    const existingIndex = this.registrations.findIndex(
      (r) => r.mealId === mealId && r.userId === userId
    );

    const meal = this.meals.find((m) => m.id === mealId);
    const mealDate = meal?.mealDate;

    if (existingIndex >= 0) {
      const updated: MealRegistration = {
        ...this.registrations[existingIndex],
        status: 'confirmed',
        guestCount,
        mealDate,
      };
      this.registrations[existingIndex] = updated;
      this.log('register_meal', `registration:${updated.id}`, `Đăng ký lại suất ăn ngày ${mealDate} (Khách: ${guestCount})`);
      this.notify();
      return updated;
    }

    const newReg: MealRegistration = {
      id: Date.now(),
      userId,
      mealId,
      guestCount,
      status: 'confirmed',
      mealDate,
      createdAt: new Date().toISOString(),
    };
    this.registrations.push(newReg);
    this.log('register_meal', `registration:${newReg.id}`, `Đăng ký suất ăn ngày ${mealDate} (Khách: ${guestCount})`);
    this.notify();
    return newReg;
  }

  updateGuestCount(mealId: number, guestCount: number, userId = this.currentUserId): MealRegistration {
    const reg = this.registrations.find((r) => r.mealId === mealId && r.userId === userId);
    if (reg) {
      reg.guestCount = Math.max(0, Math.min(10, guestCount));
      this.notify();
      return reg;
    }
    return this.registerMeal(mealId, guestCount, userId);
  }

  cancelMealRegistration(registrationId: number): MealRegistration | null {
    const reg = this.registrations.find((r) => r.id === registrationId);
    if (!reg) return null;
    reg.status = 'cancelled';
    this.log('cancel_registration', `registration:${registrationId}`, `Cắt suất ăn ID ${registrationId}`);
    this.notify();
    return reg;
  }

  approveCancelRegistration(id: number): MealRegistration | null {
    const reg = this.registrations.find((r) => r.id === id);
    if (!reg) return null;
    reg.status = 'cancelled';
    this.log('approve_cancel', `registration:${id}`, `Duyệt yêu cầu cắt suất ID ${id}`);
    this.notify();
    return reg;
  }

  rejectCancelRegistration(id: number): MealRegistration | null {
    const reg = this.registrations.find((r) => r.id === id);
    if (!reg) return null;
    reg.status = 'confirmed';
    this.log('reject_cancel', `registration:${id}`, `Từ chối yêu cầu cắt suất ID ${id}`);
    this.notify();
    return reg;
  }

  confirmRegistration(id: number): MealRegistration | null {
    const reg = this.registrations.find((r) => r.id === id);
    if (!reg) return null;
    reg.status = 'confirmed';
    this.log('confirm_registration', `registration:${id}`, `Xác nhận đăng ký suất ăn ID ${id}`);
    this.notify();
    return reg;
  }

  deleteRegistration(id: number): boolean {
    const idx = this.registrations.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.registrations.splice(idx, 1);
    this.log('delete_registration', `registration:${id}`, `Xóa đăng ký suất ăn ID ${id}`);
    this.notify();
    return true;
  }

  // ==================== MEAL OPTIONS ====================
  getAllMealOptions(): MealOption[] {
    return this.mealOptions.map((o) => {
      const user = this.users.find((u) => u.id === o.userId);
      return {
        ...o,
        user: user ? { id: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone } : undefined,
      };
    });
  }

  getMyMealOptions(userId = this.currentUserId): MealOption[] {
    return this.getAllMealOptions().filter((o) => o.userId === userId);
  }

  createMealOption(
    type: MealOptionType,
    fromDate: string,
    toDate: string,
    note?: string,
    userId = this.currentUserId
  ): MealOption {
    if (this.mealOptions.some(option => option.userId === userId && option.status === 'pending')) {
      throw new Error('Bạn đang có yêu cầu cắt suất chờ duyệt. Vui lòng chờ quản lý duyệt hoặc từ chối trước khi gửi yêu cầu tiếp.');
    }
    const isAutoApproved = type === 'cancel_today';
    const newOption: MealOption = {
      id: Date.now(),
      userId,
      type,
      fromDate,
      toDate,
      note,
      status: isAutoApproved ? 'approved' : 'pending',
      createdAt: new Date().toISOString(),
      approvedAt: isAutoApproved ? new Date().toISOString() : undefined,
      approvedBy: isAutoApproved ? userId : undefined,
    };
    this.mealOptions.unshift(newOption);

    if (isAutoApproved) {
      const from = new Date(fromDate).getTime();
      const to = new Date(toDate).getTime();

      this.registrations.forEach((r) => {
        if (r.userId === userId) {
          const meal = this.meals.find((m) => m.id === r.mealId);
          if (meal) {
            const mealTime = new Date(meal.mealDate).getTime();
            if (mealTime >= from && mealTime <= to && r.status !== 'completed') {
              r.status = 'cancelled';
            }
          }
        }
      });
    }

    this.log('create_meal_option', `meal_option:${newOption.id}`, `Tạo yêu cầu cắt suất (${type}) từ ${fromDate} đến ${toDate}`);
    this.notify();
    return newOption;
  }

  approveMealOption(id: number): MealOption | null {
    const opt = this.mealOptions.find((o) => o.id === id);
    if (!opt) return null;
    opt.status = 'approved';
    opt.approvedAt = new Date().toISOString();
    opt.approvedBy = this.currentUserId;

    const from = new Date(opt.fromDate).getTime();
    const to = new Date(opt.toDate).getTime();

    this.registrations.forEach((r) => {
      if (r.userId === opt.userId) {
        const meal = this.meals.find((m) => m.id === r.mealId);
        if (meal) {
          const mealTime = new Date(meal.mealDate).getTime();
          if (mealTime >= from && mealTime <= to && r.status !== 'completed') {
            r.status = 'cancelled';
          }
        }
      }
    });

    this.log('approve_meal_option', `meal_option:${id}`, `Duyệt yêu cầu cắt suất ID ${id}`);
    this.notify();
    return opt;
  }

  rejectMealOption(id: number): MealOption | null {
    const opt = this.mealOptions.find((o) => o.id === id);
    if (!opt) return null;
    opt.status = 'rejected';
    this.log('reject_meal_option', `meal_option:${id}`, `Từ chối yêu cầu cắt suất ID ${id}`);
    this.notify();
    return opt;
  }

  deleteMealOption(id: number): boolean {
    const idx = this.mealOptions.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    this.mealOptions.splice(idx, 1);
    this.log('delete_meal_option', `meal_option:${id}`, `Hủy yêu cầu cắt suất ID ${id}`);
    this.notify();
    return true;
  }

  reactivateMealOption(id: number, fromDate: string) {
    const option = this.mealOptions.find(o => o.id === id);
    if (!option || option.status !== 'approved' || option.toDate < fromDate) throw new Error('Yêu cầu không còn hiệu lực.');
    const endDate = option.toDate;
    if (fromDate <= option.fromDate) option.status = 'rejected';
    else option.toDate = new Date(Date.parse(`${fromDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    let restoredCount = 0;
    for (const meal of this.meals) {
      if (meal.mealDate < fromDate || meal.mealDate < option.fromDate || meal.mealDate > endDate || meal.isCancelled) continue;
      if (this.mealOptions.some(o => o.userId === option.userId && o.status === 'approved' && o.fromDate <= meal.mealDate && o.toDate >= meal.mealDate)) continue;
      const existing = this.registrations.find(r => r.userId === option.userId && r.mealId === meal.id);
      if (!existing || existing.status === 'cancelled') { this.registerMeal(meal.id, 0, option.userId); restoredCount++; }
    }
    this.notify();
    return { fromDate, restoredCount };
  }

  // ==================== PAYMENTS ====================
  getAllPayments(): Payment[] {
    return this.payments.map((p) => {
      const user = this.users.find((u) => u.id === p.userId);
      return {
        ...p,
        userName: user?.fullName || 'Cán bộ',
        user: user ? { id: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone } : undefined,
      };
    });
  }

  getMyPayments(userId = this.currentUserId): Payment[] {
    return this.getAllPayments().filter((p) => p.userId === userId);
  }

  createPayment(data: CreatePaymentRequest): Payment {
    const newPayment: Payment = {
      id: Date.now(),
      userId: data.userId,
      paymentDate: data.paymentDate,
      amount: data.amount,
      status: data.status || 'unpaid',
      isPaid: data.status === 'paid',
      paidAmount: data.status === 'paid' ? data.amount : null,
    };
    this.payments.unshift(newPayment);
    this.log('create_payment', `payment:${newPayment.id}`, `Tạo khoản thanh toán ${data.amount}đ cho User ID ${data.userId}`);
    this.notify();
    return newPayment;
  }

  updatePayment(id: number, data: UpdatePaymentRequest): Payment | null {
    const p = this.payments.find((x) => x.id === id);
    if (!p) return null;
    if (data.paymentDate) p.paymentDate = data.paymentDate;
    if (data.amount !== undefined) p.amount = data.amount;
    if (data.status) {
      p.status = data.status;
      p.isPaid = data.status === 'paid';
    }
    this.log('update_payment', `payment:${id}`, `Cập nhật khoản thanh toán ID ${id}`);
    this.notify();
    return p;
  }

  markPaymentPaid(id: number, paidAmount?: number, billImg?: string | null): Payment | null {
    const p = this.payments.find((x) => x.id === id);
    if (!p) return null;
    p.status = 'paid';
    p.isPaid = true;
    p.paidAmount = paidAmount !== undefined ? paidAmount : p.amount;
    p.paidAt = new Date().toISOString();
    if (billImg) p.billImg = billImg;
    this.log('mark_paid', `payment:${id}`, `Xác nhận thanh toán ${p.paidAmount}đ cho khoản thu ID ${id}`);
    this.notify();
    return p;
  }

  deletePayment(id: number): boolean {
    const idx = this.payments.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.payments.splice(idx, 1);
    this.log('delete_payment', `payment:${id}`, `Xóa khoản thanh toán ID ${id}`);
    this.notify();
    return true;
  }

  // ==================== NOTIFICATIONS ====================
  getAllNotifications(): NotificationItem[] {
    return this.notifications.map((n) => {
      const creator = this.users.find((u) => u.id === n.createdBy);
      return {
        ...n,
        creatorName: creator?.fullName || 'Hệ thống',
      };
    });
  }

  getMyNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  getUnseenNotificationCount(): number {
    return this.notifications.filter((n) => !n.isSeen).length;
  }

  sendNotification(data: SendNotificationRequest): NotificationItem {
    const actor = this.getCurrentUser();
    const newNotif: NotificationItem = {
      id: Date.now(),
      title: data.title,
      content: data.content,
      url: data.url || null,
      type: data.type || 'SYSTEM',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      creatorName: actor.fullName,
      isSeen: false,
    };
    this.notifications.unshift(newNotif);
    const scope = data.userIds && data.userIds.length > 0 ? `cho ${data.userIds.length} cán bộ` : 'toàn cơ quan (Broadcast)';
    this.log('send_notification', `notification:${newNotif.id}`, `Phát thông báo "${data.title}" ${scope}`);
    this.notify();
    return newNotif;
  }

  updateNotification(id: number, data: { title?: string; content?: string }): NotificationItem | null {
    const notif = this.notifications.find((n) => n.id === id);
    if (!notif) return null;
    if (data.title) notif.title = data.title;
    if (data.content) notif.content = data.content;
    this.log('update_notification', `notification:${id}`, `Sửa thông báo "${notif.title}"`);
    this.notify();
    return notif;
  }

  deleteNotification(id: number): boolean {
    const idx = this.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.notifications.splice(idx, 1);
    this.log('delete_notification', `notification:${id}`, `Xóa thông báo ID ${id}`);
    this.notify();
    return true;
  }

  markNotificationAsSeen(notificationId: number) {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.isSeen = true;
      notif.seenAt = new Date().toISOString();
      this.notify();
    }
  }

  markAllNotificationsAsSeen() {
    this.notifications.forEach((n) => {
      n.isSeen = true;
      n.seenAt = new Date().toISOString();
    });
    this.notify();
  }

  // ==================== SETTINGS ====================
  getScheduleConfig(): MealScheduleConfig {
    return { ...this.scheduleConfig };
  }

  getMealScheduleConfigDays(): MealScheduleConfigResponse {
    return {
      days: [...this.dayConfigs],
      useMealConfig: true,
    };
  }

  updateMealScheduleConfigDays(days: MealScheduleDayConfig[]): MealScheduleConfigResponse {
    this.dayConfigs = [...days];
    this.log('update_meal_schedule_config', 'system_setting:meal_schedule_config', 'Cập nhật các ngày ăn trong tuần');
    this.notify();
    return {
      days: this.dayConfigs,
      useMealConfig: true,
    };
  }

  updateSettingKey(key: string, value: string): SystemSettingItem {
    if (key === 'meal_price') this.scheduleConfig.mealPrice = parseInt(value, 10) || 30000;
    if (key === 'guest_meal_price') this.scheduleConfig.guestMealPrice = parseInt(value, 10) || 35000;
    if (key === 'registration_close_time') this.scheduleConfig.cutoffTime = value;
    if (key === 'payment_qr_image') this.scheduleConfig.paymentQrImage = value;

    this.log('update_setting', `system_setting:${key}`, `Cập nhật cấu hình ${key} = ${value}`);
    this.notify();
    return {
      id: Date.now(),
      settingKey: key,
      settingValue: value,
    };
  }

  getRawSystemSettings(): SystemSettingItem[] {
    return [
      { id: 1, settingKey: 'meal_price', settingValue: String(this.scheduleConfig.mealPrice), displayName: 'Giá suất ăn cán bộ', description: 'Đơn giá 1 suất ăn trưa chuẩn của cán bộ nhân viên' },
      { id: 2, settingKey: 'guest_meal_price', settingValue: String(this.scheduleConfig.guestMealPrice || 35000), displayName: 'Giá suất ăn khách', description: 'Đơn giá 1 suất ăn cho khách mời đi kèm' },
      { id: 3, settingKey: 'registration_close_time', settingValue: this.scheduleConfig.cutoffTime, displayName: 'Giờ đóng đăng ký & cắt suất', description: 'Thời hạn muộn nhất để báo suất hoặc cắt suất trong ngày' },
      { id: 4, settingKey: 'meal_completion_time', settingValue: '12:00', displayName: 'Giờ hoàn thành bữa ăn', description: 'Thời điểm chuyển trạng thái suất ăn sang completed' },
      { id: 5, settingKey: 'payment_qr_image', settingValue: this.scheduleConfig.paymentQrImage || '', displayName: 'Mã QR thanh toán', description: 'Ảnh mã QR tài khoản ngân hàng cơ quan' },
    ];
  }

  // ==================== AUDIT LOGS ====================
  getAuditLogs(): AuditLogItem[] {
    return [...this.auditLogs];
  }

  // ==================== DASHBOARD KPI & CHARTS ====================
  getDashboardHome(date?: string): DashboardHomeData {
    const today = date || formatBusinessDate(new Date());
    const todayMeal = this.meals.find((m) => m.mealDate === today);
    const todayRegs = todayMeal && !todayMeal.isCancelled && todayMeal.status === 'active'
      ? this.registrations.filter((r) => r.mealId === todayMeal.id && r.status === 'confirmed') : [];
    const totalGuests = todayRegs.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const totalSlots = todayRegs.length + totalGuests;

    const unpaidPayments = this.payments.filter((p) => p.status === 'unpaid' || p.status === 'overdue');
    const totalOutstanding = unpaidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingCount = this.registrations.filter((r) => r.status === 'pending').length + this.mealOptions.filter((o) => o.status === 'pending').length;

    return {
      todayMeal: todayMeal ? {
        meal_id: todayMeal.id,
        meal_date: today,
        is_cancelled: todayMeal ? (todayMeal.isCancelled ? 1 : 0) : 0,
        total_meal_slots: totalSlots,
        meal_price: this.scheduleConfig.mealPrice,
        guest_meal_price: this.scheduleConfig.guestMealPrice || 35000,
      } : null,
      todayStaff: {
        registered_staff_count: todayRegs.length,
        total_guest_count: totalGuests,
        total_meal_slots: totalSlots,
      },
      weeklyChart: [
        { meal_date: 'T2 (21/09)', total_meal_slots: 138, registered_staff_count: 132 },
        { meal_date: 'T3 (22/09)', total_meal_slots: 145, registered_staff_count: 138 },
        { meal_date: 'T4 (23/09)', total_meal_slots: 140, registered_staff_count: 135 },
        { meal_date: 'T5 (24/09)', total_meal_slots: 152, registered_staff_count: 142 },
        { meal_date: 'T6 (25/09)', total_meal_slots: 142, registered_staff_count: 135 },
        { meal_date: 'T7 (26/09)', total_meal_slots: 0, registered_staff_count: 0 },
        { meal_date: 'CN (27/09)', total_meal_slots: 0, registered_staff_count: 0 },
      ],
      paymentList: this.payments.slice(0, 5).map((p) => {
        const u = this.users.find((x) => x.id === p.userId);
        return {
          user_id: p.userId,
          full_name: u?.fullName || 'Cán bộ',
          username: u?.username || 'cb',
          payment_date: p.paymentDate,
          amount: p.amount,
          paid_amount: p.paidAmount,
          is_paid: p.isPaid,
          payment_status: p.status,
        };
      }),
      outstanding: {
        unpaid_record_count: unpaidPayments.length,
        total_outstanding_amount: totalOutstanding,
      },
      pendingMealOptionCount: pendingCount,
      unseenNotificationCount: this.getUnseenNotificationCount(),
    };
  }

  getDashboardChart(period: 'week' | 'month' | 'year' = 'week', date?: string, facility: FacilityFilter = 'all'): DashboardChartResponse {
    if (facility !== 'all') {
      const anchor = date || formatBusinessDate(new Date());
      const day = new Date(`${anchor}T12:00:00Z`);
      const start = new Date(day);
      const end = new Date(day);
      if (period === 'week') {
        start.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
        end.setTime(start.getTime() + 6 * 86400000);
      } else if (period === 'month') {
        start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0);
      } else { start.setUTCMonth(0, 1); end.setUTCMonth(11, 31); }
      const from = start.toISOString().slice(0,10), to = end.toISOString().slice(0,10);
      const data: DashboardChartResponse['data'] = [];
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const current = cursor.toISOString().slice(0,10);
        const label = period === 'year' ? current.slice(0,7) : current;
        let point = data.find(item => item.meal_date === label);
        if (!point) { point = { meal_date: label, total_meal_slots: 0, registered_staff_count: 0 }; data.push(point); }
        const meal = this.meals.find(item => item.mealDate === current && !item.isCancelled && item.status === 'active');
        if (!meal) continue;
        for (const registration of this.registrations.filter(item => item.mealId === meal.id && item.status === 'completed')) {
          const user = this.users.find(item => item.id === registration.userId);
          if (user && getFacility(user) === (facility === 'unassigned' ? null : facility)) {
            point.registered_staff_count++;
            point.total_meal_slots += 1 + registration.guestCount;
          }
        }
        if (current < formatBusinessDate(new Date()) || (current === formatBusinessDate(new Date()) && Date.now() >= Date.parse(`${current}T12:00:00+07:00`))) {
          point.total_meal_slots += this.getMealGuestCounts(current,current).filter(item => item.facilityId === facility).reduce((sum,item)=>sum+item.guestCount,0);
        }
      }
      return { period, granularity: period === 'year' ? 'month' : 'day', from, to, data };
    }
    if (period === 'year') {
      return {
        period: 'year',
        granularity: 'month',
        from: '2026-01-01',
        to: '2026-12-31',
        data: Array.from({ length: 12 }, (_, i) => ({
          meal_date: `Tháng ${i + 1}`,
          total_meal_slots: i < 9 ? Math.floor(2800 + Math.random() * 400) : 0,
          registered_staff_count: i < 9 ? Math.floor(130 + Math.random() * 10) : 0,
        })),
      };
    }

    if (period === 'month') {
      return {
        period: 'month',
        granularity: 'day',
        from: '2026-09-01',
        to: '2026-09-30',
        data: Array.from({ length: 30 }, (_, i) => {
          const day = i + 1;
          const isWeekend = day % 7 === 0 || day % 7 === 6;
          return {
            meal_date: `${day}/09`,
            total_meal_slots: isWeekend ? 0 : Math.floor(135 + Math.random() * 20),
            registered_staff_count: isWeekend ? 0 : Math.floor(130 + Math.random() * 10),
          };
        }),
      };
    }

    // Week
    return {
      period: 'week',
      granularity: 'day',
      from: '2026-09-21',
      to: '2026-09-27',
      data: [
        { meal_date: 'T2 (21/09)', total_meal_slots: 138, registered_staff_count: 132 },
        { meal_date: 'T3 (22/09)', total_meal_slots: 145, registered_staff_count: 138 },
        { meal_date: 'T4 (23/09)', total_meal_slots: 140, registered_staff_count: 135 },
        { meal_date: 'T5 (24/09)', total_meal_slots: 152, registered_staff_count: 142 },
        { meal_date: 'T6 (25/09)', total_meal_slots: 142, registered_staff_count: 135 },
        { meal_date: 'T7 (26/09)', total_meal_slots: 0, registered_staff_count: 0 },
        { meal_date: 'CN (27/09)', total_meal_slots: 0, registered_staff_count: 0 },
      ],
    };
  }
}

export const mockStore = new MockStore();
