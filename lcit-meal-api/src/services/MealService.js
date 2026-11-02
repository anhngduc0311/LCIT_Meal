const MEAL_STATUS = require("../constants/Meal");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");

class MealService {
  constructor(
    mealRepository,
    mealRegistrationRepository,
    notificationService,
    auditLogService,
  ) {
    this.mealRepository = mealRepository;
    this.mealRegistrationRepository = mealRegistrationRepository;
    this.notificationService = notificationService;
    this.auditLogService = auditLogService;
  }

  async list() {
    return this.mealRepository.list();
  }

  async guestCounts(from, to) { return this.mealRepository.filterGuestCounts(from, to); }

  async removeGuests(id, data, actor = {}) {
    if (!(actor.roles || []).some(role => ['admin', 'manager'].includes(role))) throw new AppError('Bạn không có quyền bỏ suất khách', 403);
    if (![1, 2].includes(data.facilityId) || !Number.isInteger(data.count) || data.count < 1 || data.count > 1000) {
      throw new AppError('Chọn cơ sở hợp lệ và số suất khách từ 1 đến 1000', 400);
    }
    const meal = await this.get(id);
    const result = await this.mealRepository.removeGuestCount(id, data.facilityId, data.count, actor.actorId);
    if (!result) throw new AppError('Số suất khách đã thay đổi, không đủ để bỏ hoặc bếp đã ngừng phục vụ. Vui lòng tải lại.', 409);
    await this.logAction(LOG_ACTION.ACTION_UPDATE, actor, `meal:${id}`, `Bỏ ${data.count} suất khách cơ sở ${data.facilityId}, ngày ${meal.mealDate}`, null, result);
    return { ...result, mealDate: meal.mealDate };
  }

  async addGuests(id, data, actor = {}) {
    if (!(actor.roles || []).some(role => ['admin', 'manager'].includes(role))) throw new AppError('Bạn không có quyền thêm suất khách', 403);
    if (![1,2].includes(data.facilityId) || !Number.isInteger(data.count) || data.count < 1 || data.count > 1000) {
      throw new AppError('Chọn cơ sở hợp lệ và số suất khách từ 1 đến 1000', 400);
    }
    const meal = await this.get(id);
    const result = await this.mealRepository.addGuestCount(id, data.facilityId, data.count, actor.actorId);
    if (!result) throw new AppError('Bếp đã nghỉ hoặc ngừng phục vụ ngày này', 409);
    await this.logAction(LOG_ACTION.ACTION_UPDATE, actor, `meal:${id}`, `Thêm ${data.count} suất khách cơ sở ${data.facilityId}, ngày ${meal.mealDate}`, null, result);
    return { ...result, mealDate: meal.mealDate };
  }

  async get(id) {
    const meal = await this.mealRepository.get(id);

    if (!meal) {
      throw new AppError("Bếp ăn không tồn tại", 404);
    }

    return meal;
  }

  async filter(fromDate, toDate, status, isCancelled) {
    return this.mealRepository.filter(fromDate, toDate, status, isCancelled);
  }

  // Lọc bếp ăn kèm phân trang
  async filterPaginated(fromDate, toDate, status, isCancelled, page = 1, limit = 10) {
    return this.mealRepository.filterPaginated(
      fromDate,
      toDate,
      status,
      isCancelled,
      page,
      limit
    );
  }

  // Tổng hợp số suất ăn cần chuẩn bị cho 1 ngày (join bảng trung gian meal_registration)
  async getSummary(id) {
    const summary = await this.mealRepository.getSummary(id);

    if (!summary) {
      throw new AppError("Bếp ăn không tồn tại", 404);
    }

    return summary;
  }

  async create(data, actor = {}) {
    this.validateMealDate(data);

    const existing = await this.mealRepository.getByDate(data.mealDate);

    if (existing) {
      throw new AppError("Ngày này đã có bếp ăn", 409);
    }

    const meal = await this.mealRepository.create({
      mealDate: data.mealDate,
      note: data.note,
      status: data.status || MEAL_STATUS.ACTIVE,
    });

    await this.logAction(
      LOG_ACTION.ACTION_CREATE,
      actor,
      `meal:${meal.id}`,
      "Tạo bếp ăn mới",
      null,
      meal,
    );

    return meal;
  }

  validateMealDate(data) {
    if (!data.mealDate) {
      throw new AppError("mealDate là bắt buộc", 400);
    }
  }

  async update(id, data, actor = {}) {
    const meal = await this.get(id);

    const updated = await this.mealRepository.update(id, {
      mealDate: data.mealDate || meal.mealDate,
      note: data.note !== undefined ? data.note : meal.note,
      status: data.status || meal.status,
    });

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal:${id}`,
      "Cập nhật bếp ăn",
      meal,
      updated,
    );

    return updated;
  }

  // Hủy bếp ăn 1 ngày - đồng thời báo cho toàn bộ nhân viên đã đăng ký ăn ngày đó
  async cancel(id, note, actor = {}) {
    const meal = await this.get(id);

    if (meal.isCancelled) {
      throw new AppError("Bếp ăn đã bị hủy trước đó", 409);
    }

    const cancelled = await this.mealRepository.cancel(
      id,
      actor.actorId || null,
      note,
    );

    await this.logAction(
      LOG_ACTION.ACTION_CANCEL,
      actor,
      `meal:${id}`,
      note || "Hủy bếp ăn",
      meal,
      cancelled,
    );

    // Thông báo cho những ai đã đăng ký ăn ngày này (bảng trung gian meal_registration)
    const userIds = await this.mealRepository.getRegisteredUserIds(id);

    if (userIds.length > 0) {
      await this.notificationService.createForUsers(
        {
          title: `Bếp ăn ngày ${meal.mealDate} đã bị hủy`,
          content: note || "Bếp ăn ngày này đã bị hủy, vui lòng không đến ăn.",
          url: `/meal/view?id=${id}`,
          createdBy: actor.actorId || null,
        },
        userIds,
      );
    }

    return cancelled;
  }

  async restore(id, actor = {}) {
    const meal = await this.get(id);

    if (!meal.isCancelled) {
      throw new AppError("Bếp ăn hiện không ở trạng thái bị hủy", 409);
    }

    const restored = await this.mealRepository.restore(id);

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal:${id}`,
      "Mở lại bếp ăn đã hủy",
      meal,
      restored,
    );

    return restored;
  }

  async delete(id, actor = {}) {
    const meal = await this.get(id);

    await this.mealRepository.delete(id);

    await this.logAction(
      LOG_ACTION.ACTION_DELETE,
      actor,
      `meal:${id}`,
      "Xóa bếp ăn",
      meal,
      null,
    );

    return true;
  }

  async logAction(action, actor, target, detail, oldData, newData) {
    try {
      await this.auditLogService.create({
        logActor: actor.actorId || null,
        logAction: action,
        logTarget: target,
        logResult: "success",
        logDetail: detail,
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
        status: "success",
        oldData,
        newData,
      });
    } catch (error) {
      console.error("Ghi audit log thất bại:", error.message);
    }
  }
}

module.exports = MealService;
