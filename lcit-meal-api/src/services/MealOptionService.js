const {
  MEAL_OPTION_TYPE,
  MEAL_OPTION_STATUS,
  AUTO_APPROVE_TYPES,
} = require("../constants/MealOption");
const ROLE = require("../constants/Role");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");

const REGISTRATION_CLOSE_TIME_KEY = "registration_close_time";

const getVietnamNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
};

class MealOptionService {
  constructor(
    mealOptionRepository,
    userRepository,
    notificationService,
    auditLogService,
    mealRegistrationRepository,
    systemSettingRepository,
  ) {
    this.mealOptionRepository = mealOptionRepository;
    this.userRepository = userRepository;
    this.notificationService = notificationService;
    this.auditLogService = auditLogService;
    this.mealRegistrationRepository = mealRegistrationRepository;
    this.systemSettingRepository = systemSettingRepository;
  }

  // Cấu hình `registration_close_time` (vd "09:00") quy định giờ đóng
  // đăng ký/hủy suất ăn TRONG NGÀY. Sau giờ này, bếp coi như đã bắt đầu
  // chuẩn bị nên không cho hủy/cắt suất ăn của HÔM NAY nữa (không áp dụng
  // cho yêu cầu cắt bắt đầu từ ngày mai trở đi). Nếu chưa cấu hình thì
  // không giới hạn.
  async assertBeforeRegistrationCutoff(fromDate) {
    const { date: today, time: nowTime } = getVietnamNow();
    if (fromDate !== today) return;
    if (!this.systemSettingRepository) return;

    const setting = await this.systemSettingRepository.getByKey(
      REGISTRATION_CLOSE_TIME_KEY,
    );
    const closeTime = setting?.settingValue || setting?.setting_value;
    if (!closeTime) return;

    if (nowTime >= closeTime) {
      throw new AppError(
        `Đã quá giờ đóng đăng ký/hủy suất ăn hôm nay (${closeTime}). Vui lòng liên hệ quản lý nếu cần điều chỉnh.`,
        400,
      );
    }
  }

  // Đồng bộ bảng meal_registration ngay khi 1 yêu cầu cắt suất ăn được duyệt
  // (dù là tự động duyệt "cancel_today" hay được quản lý duyệt tay). Nếu
  // trong khoảng ngày [fromDate, toDate] đã tồn tại sẵn các bản ghi đăng ký
  // (confirmed/pending) - vd do job autoSchedule đêm hôm trước đã tạo, hoặc
  // do chính user đã tự đăng ký trước khi xin cắt - thì phải chuyển chúng
  // sang "cancelled", nếu không bếp/báo cáo vẫn tính nhầm suất ăn cho họ.
  async syncMealRegistrations(mealOption, actor = {}) {
    if (!this.mealRegistrationRepository) return [];

    const cancelled =
      await this.mealRegistrationRepository.cancelByUserAndDateRange(
        mealOption.userId,
        mealOption.fromDate,
        mealOption.toDate,
      );

    if (cancelled.length === 0) return cancelled;

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal_registration:sync:meal_option:${mealOption.id}`,
      `Tự động hủy ${cancelled.length} suất ăn đã đăng ký sẵn (ngày ${mealOption.fromDate} - ${mealOption.toDate}) do yêu cầu hủy ăn được duyệt`,
      cancelled,
      null,
    );

    await this.notificationService.notifyRoles(
      {
        title: "Điều chỉnh suất ăn do yêu cầu hủy ăn được duyệt",
        content: `Đã tự động hủy ${cancelled.length} suất ăn đã đăng ký sẵn của ${mealOption.userName || "#" + mealOption.userId} trong khoảng ${mealOption.fromDate} - ${mealOption.toDate}, vui lòng điều chỉnh số suất cần chuẩn bị.`,
        url: `/meal-option/view?id=${mealOption.id}`,
        createdBy: actor.actorId || null,
      },
      [ROLE.ADMIN, ROLE.MANAGER],
    );

    return cancelled;
  }

  async list() {
    return this.mealOptionRepository.list();
  }

  async reactivate(id, actor = {}, fromDate) {
    if (!(actor.roles || []).includes(ROLE.ADMIN)) {
      throw new AppError("Chỉ admin được khôi phục suất ăn dài hạn", 403);
    }
    const { date: today, time } = getVietnamNow();
    const earliest = time < '08:20' ? today
      : new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const effectiveDate = fromDate || earliest;
    const parsed = typeof effectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
      ? new Date(`${effectiveDate}T00:00:00Z`) : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== effectiveDate || effectiveDate < earliest) {
      throw new AppError(`Ngày khôi phục phải từ ${earliest}; không thay đổi ngày đã chốt suất`, 400);
    }
    const option = await this.get(id);
    const user = await this.userRepository.get(option.userId);
    if (String(user?.username || '').trim().toLowerCase() === 'quanly') throw new AppError('Tài khoản quanly không tính là cán bộ ăn', 409);
    if (!user || String(user.status) !== '1') throw new AppError('Tài khoản này không còn hoạt động', 409);
    const result = await this.mealOptionRepository.reactivateWithRegistrations(id, effectiveDate, actor.actorId);
    await this.logAction(LOG_ACTION.ACTION_UPDATE, actor, `meal_option:${id}`,
      `Khôi phục ăn từ ${effectiveDate}: ${result.restoredCount} suất`, option, result);
    await this.notificationService.notifyUser({ title: 'Đã khôi phục suất ăn',
      content: `Admin đã khôi phục suất ăn của bạn từ ${effectiveDate}. Các ngày bếp nghỉ hoặc còn yêu cầu cắt khác được giữ nguyên.`,
      url: '/schedule', createdBy: actor.actorId }, option.userId);
    return result;
  }

  async get(id) {
    const mealOption = await this.mealOptionRepository.get(id);

    if (!mealOption) {
      throw new AppError("Yêu cầu hủy ăn không tồn tại", 404);
    }

    return mealOption;
  }

  async listByUser(userId) {
    return this.mealOptionRepository.listByUser(userId);
  }

  assertOwnerOrManager(userId, actor) {
    const isManagement = (actor.roles || []).some(role =>
      [ROLE.ADMIN, ROLE.MANAGER].includes(role));
    if (String(userId) !== String(actor.actorId) && !isManagement) {
      throw new AppError("Bạn không có quyền thao tác trên yêu cầu này", 403);
    }
  }

  async getForActor(id, actor) {
    const option = await this.get(id);
    this.assertOwnerOrManager(option.userId, actor);
    return option;
  }

  async filter(userId, type, status) {
    return this.mealOptionRepository.filter(userId, type, status);
  }

  // Nhân viên tạo yêu cầu hủy ăn cho chính mình.
  // admin/manager có thể tạo hộ (truyền data.userId).
  async create(data, actor = {}) {
    require('../ultis/managerMealDeadline').assertManagerMealEditable(data.fromDate, actor);
    this.validateCreateData(data);
    await this.assertBeforeRegistrationCutoff(data.fromDate);

    const targetUserId = data.userId || actor.actorId;
    this.assertOwnerOrManager(targetUserId, actor);

    const isAutoApproved = AUTO_APPROVE_TYPES.includes(data.type);

    const mealOption = await this.mealOptionRepository.create({
      userId: targetUserId,
      type: data.type,
      fromDate: data.fromDate,
      toDate: data.toDate,
      note: data.note,
      status: isAutoApproved
        ? MEAL_OPTION_STATUS.APPROVED
        : MEAL_OPTION_STATUS.PENDING,
      createdBy: actor.actorId || null,
      approvedAt: isAutoApproved ? new Date() : null,
      approvedBy: isAutoApproved ? actor.actorId || null : null,
    });

    await this.logAction(
      LOG_ACTION.ACTION_CREATE,
      actor,
      `meal_option:${mealOption.id}`,
      "Tạo yêu cầu hủy ăn",
      null,
      mealOption,
    );

    // "cancel_today" được tự động duyệt ngay khi tạo -> đồng bộ luôn
    // meal_registration cho ngày hôm nay (nếu đã có sẵn đăng ký confirmed).
    if (isAutoApproved) {
      await this.syncMealRegistrations(mealOption, actor);
    }

    // Yêu cầu cần duyệt (hủy theo lịch/vĩnh viễn) -> báo cho admin + manager biết mà xử lý
    if (!isAutoApproved) {
      await this.notificationService.notifyRoles(
        {
          title: "Yêu cầu hủy ăn theo lịch cần duyệt",
          content: `Nhân viên ${mealOption.userName || "#" + targetUserId} yêu cầu hủy ăn từ ${data.fromDate} đến ${data.toDate}, đang chờ quản lý duyệt.`,
          url: `/meal-option/view?id=${mealOption.id}`,
          createdBy: actor.actorId || null,
        },
        [ROLE.ADMIN, ROLE.MANAGER],
      );
    }

    return mealOption;
  }

  validateCreateData(data) {
    if (!data.type || !Object.values(MEAL_OPTION_TYPE).includes(data.type)) {
      throw new AppError(
        `type không hợp lệ, phải là một trong: ${Object.values(MEAL_OPTION_TYPE).join(", ")}`,
        400,
      );
    }

    if (!data.fromDate) {
      throw new AppError("fromDate là bắt buộc", 400);
    }

    if (!data.toDate) {
      throw new AppError("toDate là bắt buộc", 400);
    }

    if (new Date(data.fromDate) > new Date(data.toDate)) {
      throw new AppError("fromDate không thể sau toDate", 400);
    }
  }

  // Chỉ cho sửa khi yêu cầu còn "pending", và chỉ chủ sở hữu hoặc admin mới được sửa
  async update(id, data, actor = {}) {
    const mealOption = await this.get(id);

    this.assertOwnerOrAdmin(mealOption, actor);

    if (mealOption.status !== MEAL_OPTION_STATUS.PENDING) {
      throw new AppError(
        "Chỉ có thể sửa yêu cầu đang ở trạng thái chờ duyệt",
        409,
      );
    }

    const updated = await this.mealOptionRepository.update(id, {
      type: data.type || mealOption.type,
      fromDate: data.fromDate || mealOption.fromDate,
      toDate: data.toDate || mealOption.toDate,
      note: data.note !== undefined ? data.note : mealOption.note,
      updatedBy: actor.actorId || null,
    });

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal_option:${id}`,
      "Cập nhật yêu cầu hủy ăn",
      mealOption,
      updated,
    );

    return updated;
  }

  // Quản lý/admin duyệt yêu cầu
  async approve(id, actor = {}) {
    const mealOption = await this.get(id);
    require('../ultis/managerMealDeadline').assertManagerMealEditable(mealOption.fromDate, actor);

    if (mealOption.status !== MEAL_OPTION_STATUS.PENDING) {
      throw new AppError("Yêu cầu này đã được xử lý trước đó", 409);
    }

    const approved = await this.mealOptionRepository.setDecision(
      id,
      MEAL_OPTION_STATUS.APPROVED,
      actor.actorId || null,
    );

    await this.logAction(
      LOG_ACTION.ACTION_APPROVE,
      actor,
      `meal_option:${id}`,
      "Duyệt yêu cầu hủy ăn",
      mealOption,
      approved,
    );

    await this.notificationService.notifyUser(
      {
        title: "Yêu cầu hủy ăn đã được duyệt",
        content: `Yêu cầu hủy ăn từ ${mealOption.fromDate} đến ${mealOption.toDate} của bạn đã được duyệt.`,
        url: `/meal-option/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      mealOption.userId,
    );

    // Đồng bộ ngay các bản ghi meal_registration đã tồn tại sẵn trong
    // khoảng ngày vừa được duyệt (xem giải thích ở syncMealRegistrations).
    await this.syncMealRegistrations(approved, actor);

    return approved;
  }

  // Quản lý/admin từ chối yêu cầu
  async reject(id, note, actor = {}) {
    const mealOption = await this.get(id);

    if (mealOption.status !== MEAL_OPTION_STATUS.PENDING) {
      throw new AppError("Yêu cầu này đã được xử lý trước đó", 409);
    }

    const rejected = await this.mealOptionRepository.setDecision(
      id,
      MEAL_OPTION_STATUS.REJECTED,
      actor.actorId || null,
      note,
    );

    await this.logAction(
      LOG_ACTION.ACTION_REJECT,
      actor,
      `meal_option:${id}`,
      note || "Từ chối yêu cầu hủy ăn",
      mealOption,
      rejected,
    );

    await this.notificationService.notifyUser(
      {
        title: "Yêu cầu hủy ăn bị từ chối",
        content:
          note ||
          `Yêu cầu hủy ăn từ ${mealOption.fromDate} đến ${mealOption.toDate} của bạn đã bị từ chối.`,
        url: `/meal-option/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      mealOption.userId,
    );

    return rejected;
  }

  // Chủ sở hữu có thể hủy yêu cầu khi còn "pending"; admin có thể xóa bất kỳ lúc nào
  async delete(id, actor = {}) {
    const mealOption = await this.get(id);

    const isAdmin = (actor.roles || []).includes(ROLE.ADMIN);

    if (!isAdmin) {
      this.assertOwnerOrAdmin(mealOption, actor);

      if (mealOption.status !== MEAL_OPTION_STATUS.PENDING) {
        throw new AppError(
          "Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt",
          409,
        );
      }
    }

    await this.mealOptionRepository.delete(id);

    await this.logAction(
      LOG_ACTION.ACTION_DELETE,
      actor,
      `meal_option:${id}`,
      "Xóa yêu cầu hủy ăn",
      mealOption,
      null,
    );

    return true;
  }

  assertOwnerOrAdmin(mealOption, actor) {
    const isOwner = String(mealOption.userId) === String(actor.actorId);
    const isAdmin = (actor.roles || []).includes(ROLE.ADMIN);

    if (!isOwner && !isAdmin) {
      throw new AppError("Bạn không có quyền thao tác trên yêu cầu này", 403);
    }
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

module.exports = MealOptionService;
