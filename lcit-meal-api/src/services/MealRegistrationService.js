const { assertManagerMealEditable } = require('../ultis/managerMealDeadline');
const MEAL_REGISTRATION_STATUS = require("../constants/MealRegistration");
const MEAL_COMPLETION_STATUS = require("../constants/MealCompletionStatus");
const ROLE = require("../constants/Role");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");

// Số khách tối đa 1 nhân viên được đăng ký kèm cho 1 ngày ăn.
const MAX_GUEST_PER_REGISTRATION = 10;

const REGISTRATION_CLOSE_TIME_KEY = "registration_close_time";

const getVietnamNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
};

class MealRegistrationService {
  constructor(
    mealRegistrationRepository,
    mealRepository,
    notificationService,
    auditLogService,
    systemSettingRepository,
  ) {
    this.mealRegistrationRepository = mealRegistrationRepository;
    this.mealRepository = mealRepository;
    this.notificationService = notificationService;
    this.auditLogService = auditLogService;
    this.systemSettingRepository = systemSettingRepository;
  }

  // Read-only timing contract used by the employee web page.
  async getRegistrationWindow(now = new Date()) {
    const { date: today, time: nowTime } = getVietnamNow(now);
    const [closeSetting, completionSetting] = await Promise.all([
      this.systemSettingRepository.getByKey(REGISTRATION_CLOSE_TIME_KEY),
      this.systemSettingRepository.getByKey('meal_completion_time'),
    ]);
    const readTime = setting => {
      const value = setting?.settingValue ?? setting?.setting_value;
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : null;
    };
    const closeTime = readTime(closeSetting);
    const completionTime = readTime(completionSetting) || '12:00';
    const isPastClose = Boolean(closeTime) && nowTime >= closeTime;
    const isPastCompletion = nowTime >= completionTime;
    const nextDay = new Date(`${today}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return {
      today, nowTime, closeTime, completionTime, isPastClose, isPastCompletion,
      targetDate: isPastCompletion ? nextDay.toISOString().slice(0, 10) : today,
      targetState: !isPastCompletion && isPastClose ? 'late' : 'open',
    };
  }

  // Kiểm tra xem người dùng có được phép cắt suất không
  // Trả về object: { canCancel, requiresApproval, reason }
  async checkCancellationPermission(registration, meal, actor) {
    const { date: today, time: nowTime } = getVietnamNow();
    assertManagerMealEditable(meal.mealDate, actor);
    const isManagement = (actor.roles || []).some((role) =>
      [ROLE.ADMIN, ROLE.MANAGER].includes(role),
    );

    // Quản lý được điều chỉnh bảng ăn bất kỳ lúc nào, kể cả sau giờ ăn.
    if (isManagement) return { canCancel: true, requiresApproval: false, reason: null };

    // 1. Kiểm tra nếu suất ăn đã hoàn thành (COMPLETED status)
    if (registration.status === MEAL_REGISTRATION_STATUS.COMPLETED) {
      return {
        canCancel: false,
        reason: "Suất ăn đã hoàn thành (đã ăn), không thể cắt",
      };
    }

    // 2. Kiểm tra nếu meal đã qua giờ hoàn thành (completion_status = COMPLETED)
    if (
      meal.completionStatus === MEAL_COMPLETION_STATUS.COMPLETED
    ) {
      return {
        canCancel: false,
        reason: "Suất ăn đã quá giờ hoàn thành, không thể cắt",
      };
    }

    // 3. Nếu là ngày trong quá khứ (không phải hôm nay)
    if (meal.mealDate < today && !isManagement) {
      return {
        canCancel: false,
        reason: "Không thể cắt suất ăn của ngày đã qua",
      };
    }

    // 4. Kiểm tra registration_close_time cho ngày hôm nay
    if (meal.mealDate === today && this.systemSettingRepository) {
      const setting = await this.systemSettingRepository.getByKey(
        REGISTRATION_CLOSE_TIME_KEY,
      );
      const closeTime = setting?.settingValue || setting?.setting_value;

      if (closeTime && nowTime >= closeTime) {
        // Quá giờ đóng đăng ký, nhưng chưa quá giờ hoàn thành bữa ăn
        if (!isManagement) {
          // Cắt từng ngày không tạo hàng chờ duyệt. Sau giờ chốt thì chặn
          // thao tác như ứng dụng cá nhân; chỉ khoảng/dài hạn cần duyệt.
          return {
            canCancel: false,
            requiresApproval: false,
            reason: `Đã quá giờ cắt suất hôm nay (${closeTime}). Vui lòng liên hệ quản lý nếu cần điều chỉnh.`,
          };
        }
        // Admin/manager có thể cắt ngay
        return {
          canCancel: true,
          requiresApproval: false,
          reason: null,
        };
      }
    }

    // 5. Bình thường có thể cắt
    return {
      canCancel: true,
      requiresApproval: false,
      reason: null,
    };
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

  async list() {
    return this.mealRegistrationRepository.list();
  }

  async get(id) {
    if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
      throw new AppError('Mã đăng ký suất ăn không hợp lệ', 400);
    }
    const registration = await this.mealRegistrationRepository.get(id);

    if (!registration) {
      throw new AppError("Đăng ký suất ăn không tồn tại", 404);
    }

    return registration;
  }

  async getForActor(id, actor) {
    const registration = await this.get(id);
    this.assertOwnerOrManager(registration, actor);
    return registration;
  }

  async listByUser(userId) {
    return this.mealRegistrationRepository.listByUser(userId);
  }

  // Danh sách toàn bộ user đăng ký ăn 1 ngày cụ thể (bếp dùng để biết số lượng suất cần nấu)
  async listByMeal(mealId) {
    await this.getMealOrFail(mealId);

    return this.mealRegistrationRepository.listByMeal(mealId);
  }

  async getSummaryByMeal(mealId) {
    await this.getMealOrFail(mealId);

    return this.mealRegistrationRepository.getSummaryByMeal(mealId);
  }

  async filter(userId, mealId, status, fromDate, toDate) {
    return this.mealRegistrationRepository.filter(
      userId,
      mealId,
      status,
      fromDate,
      toDate,
    );
  }

  // Lọc đăng ký kèm phân trang
  async filterPaginated(
    userId,
    mealId,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  ) {
    return this.mealRegistrationRepository.filterPaginated(
      userId,
      mealId,
      status,
      fromDate,
      toDate,
      page,
      limit
    );
  }

  // Nhân viên tự đăng ký ăn cho chính mình. admin/manager có thể đăng ký hộ (data.userId).
  async create(data, actor = {}) {
    this.validateCreateData(data);

    const targetUserId = data.userId || actor.actorId;
    this.assertOwnerOrManager({ userId: targetUserId }, actor);

    // Tài khoản admin là tài khoản quản trị hệ thống, không trực tiếp ăn nên
    // không được tự đăng ký suất ăn cho chính mình (vẫn có thể đăng ký HỘ
    // người khác qua data.userId, đó là nghiệp vụ quản lý bình thường).
    this.assertNotAdminSelfService(targetUserId, actor, "đăng ký");

    const meal = await this.mealRepository.getWithCompletionStatus(data.mealId);
    if (!meal) throw new AppError("Bếp ăn không tồn tại", 404);

    if (meal.isCancelled) {
      throw new AppError("Bếp ăn ngày này đã bị hủy, không thể đăng ký", 409);
    }

    // Không cho đăng ký suất ăn của ngày đã qua (dùng chuỗi so sánh vì
    // meal_date lưu dạng DATE "YYYY-MM-DD", so sánh string là an toàn).
    assertManagerMealEditable(meal.mealDate, actor);
    const todayStr = getVietnamNow().date;
    const isManagement = (actor.roles || []).some(role => [ROLE.ADMIN, ROLE.MANAGER].includes(role));
    if (meal.mealDate < todayStr && !isManagement) {
      throw new AppError("Không thể đăng ký suất ăn cho ngày đã qua", 409);
    }
    if (meal.completionStatus === MEAL_COMPLETION_STATUS.COMPLETED && !isManagement) {
      throw new AppError("Bữa ăn đã hoàn thành, không thể đăng ký thêm", 409);
    }
    if (!isManagement) await this.assertBeforeRegistrationCutoff(meal.mealDate);

    const existing = await this.mealRegistrationRepository.getByUserAndMeal(
      targetUserId,
      data.mealId,
    );
    if (existing?.status === MEAL_REGISTRATION_STATUS.COMPLETED && !isManagement) {
      throw new AppError("Suất ăn đã hoàn thành, không thể thay đổi", 409);
    }

    const guestCount = Number(data.guestCount) || 0;

    // Ràng buộc UNIQUE(user_id, meal_id) ở DB khiến mỗi user chỉ có tối đa 1
    // bản ghi đăng ký cho 1 ngày ăn, nên API này gánh 3 tình huống:
    //  1. Chưa có bản ghi -> tạo mới.
    //  2. Bản ghi cũ đang "cancelled" -> đăng ký lại (kích hoạt lại chính
    //     bản ghi đó thay vì báo lỗi trùng).
    //  3. Bản ghi cũ đang active nhưng ĐỔI số khách -> cập nhật số khách.
    //     Đây là luồng "Đăng ký thêm suất ăn cho khách" ở giao diện: nhân
    //     viên thường đã đăng ký suất của mình từ trước (hoặc được
    //     autoScheduleJob đăng ký sẵn) rồi mới thêm khách, nên KHÔNG được
    //     coi là đăng ký trùng.
    // Chỉ khi đăng ký lại y hệt (đang active và số khách không đổi) mới báo
    // lỗi trùng, vì lúc đó thao tác không thay đổi gì.
    const isActiveExisting =
      existing && existing.status !== MEAL_REGISTRATION_STATUS.CANCELLED;

    if (isActiveExisting && Number(existing.guestCount) === guestCount) {
      throw new AppError("Bạn đã đăng ký suất ăn này rồi", 409);
    }

    // NGHIỆP VỤ MỚI: đăng ký thêm suất cho khách KHÔNG cần quản lý duyệt -
    // mọi đăng ký (có khách hay không) đều được xác nhận ngay. Quản lý chỉ
    // được thông báo khi có khách để biết mà chuẩn bị thêm suất ăn.
    // Điều chỉnh bữa đã diễn ra phải cập nhật cả số suất thực tế.
    const newStatus = isManagement && (meal.mealDate < todayStr || meal.completionStatus === MEAL_COMPLETION_STATUS.COMPLETED)
      ? MEAL_REGISTRATION_STATUS.COMPLETED
      : MEAL_REGISTRATION_STATUS.CONFIRMED;
    assertManagerMealEditable(meal.mealDate, actor);
    const hasGuest = guestCount > 0;

    const registration = existing
      ? await this.mealRegistrationRepository.update(existing.id, {
          guestCount,
          status: newStatus,
        })
      : await this.mealRegistrationRepository.create({
          userId: targetUserId,
          mealId: data.mealId,
          guestCount,
          status: newStatus,
        });

    const actionLabel = !existing
      ? "Đăng ký"
      : isActiveExisting
        ? "Cập nhật số khách của đăng ký"
        : "Đăng ký lại";

    await this.logAction(
      existing ? LOG_ACTION.ACTION_UPDATE : LOG_ACTION.ACTION_REGISTED,
      actor,
      `meal_registration:${registration.id}`,
      `${actionLabel} ăn ngày ${meal.mealDate}${guestCount > 0 ? ` kèm ${guestCount} khách` : ""}`,
      existing || null,
      registration,
    );

    if (hasGuest) {
      await this.notificationService.notifyRoles(
        {
          title: `Đăng ký ăn kèm khách ngày ${meal.mealDate}`,
          content: `Nhân viên ${registration.userName || "#" + targetUserId} đã đăng ký ăn kèm ${guestCount} khách cho ngày ${meal.mealDate}. Vui lòng chuẩn bị thêm suất ăn.`,
          url: `/meal-registration/view?id=${registration.id}`,
          createdBy: actor.actorId || null,
        },
        [ROLE.ADMIN, ROLE.MANAGER],
      );
    }

    return registration;
  }

  validateCreateData(data) {
    if (!data.mealId) {
      throw new AppError("mealId là bắt buộc", 400);
    }

    if (data.guestCount !== undefined &&
        (typeof data.guestCount !== 'number' || !Number.isInteger(data.guestCount))) {
      throw new AppError("Số khách phải là số nguyên", 400);
    }

    if (data.guestCount !== undefined && Number(data.guestCount) < 0) {
      throw new AppError("guestCount không thể là số âm", 400);
    }

    // Vì đăng ký khách không còn qua bước quản lý duyệt, thêm chặn trên để
    // tránh nhập nhầm (vd gõ 100 thay vì 1) làm bếp nấu thừa. Chỉnh
    // MAX_GUEST_PER_REGISTRATION nếu đơn vị cần cho phép nhiều khách hơn.
    if (
      data.guestCount !== undefined &&
      Number(data.guestCount) > MAX_GUEST_PER_REGISTRATION
    ) {
      throw new AppError(
        `Chỉ được đăng ký tối đa ${MAX_GUEST_PER_REGISTRATION} khách cho mỗi ngày`,
        400,
      );
    }
  }

  async getMealOrFail(mealId) {
    const meal = await this.mealRepository.get(mealId);

    if (!meal) {
      throw new AppError("Bếp ăn không tồn tại", 404);
    }

    return meal;
  }

  // Cập nhật số lượng khách của 1 đăng ký (còn ở trạng thái pending/confirmed) - chủ sở hữu hoặc admin/manager
  async update(id, data, actor = {}) {
    const registration = await this.get(id);
    assertManagerMealEditable(registration.mealDate, actor);

    this.assertOwnerOrManager(registration, actor);
    this.assertNotAdminSelfService(registration.userId, actor, "sửa");

    const meal = await this.getMealOrFail(registration.mealId);
    if (meal.isCancelled || meal.mealDate < getVietnamNow().date ||
        registration.status === MEAL_REGISTRATION_STATUS.COMPLETED) {
      throw new AppError("Không thể sửa suất ăn đã hoàn thành hoặc bếp đã hủy", 409);
    }
    await this.assertBeforeRegistrationCutoff(meal.mealDate);
    if (data.status !== undefined && data.status !== registration.status) {
      throw new AppError("Sử dụng thao tác xác nhận hoặc cắt suất để đổi trạng thái", 400);
    }

    if (registration.status === MEAL_REGISTRATION_STATUS.CANCELLED) {
      throw new AppError("Đăng ký đã bị hủy, không thể sửa", 409);
    }

    // Sửa số khách cũng phải tuân thủ giới hạn như lúc đăng ký mới
    this.validateCreateData({
      mealId: registration.mealId,
      guestCount: data.guestCount,
    });

    const guestCount =
      data.guestCount !== undefined
        ? Number(data.guestCount)
        : registration.guestCount;

    const updated = await this.mealRegistrationRepository.update(id, {
      guestCount,
      status: data.status || registration.status,
    });

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal_registration:${id}`,
      "Cập nhật đăng ký suất ăn",
      registration,
      updated,
    );

    return updated;
  }

  // Quản lý/admin xác nhận đăng ký đang chờ (vd: đăng ký kèm khách)
  // Hoặc duyệt yêu cầu cắt suất
  async confirm(id, actor = {}) {
    const registration = await this.get(id);
    assertManagerMealEditable(registration.mealDate, actor);

    if (registration.status !== MEAL_REGISTRATION_STATUS.PENDING) {
      throw new AppError("Đăng ký này không ở trạng thái chờ xác nhận", 409);
    }

    // Kiểm tra xem đây là yêu cầu cắt hay yêu cầu đăng ký
    // Nếu oldData trong audit log có guest_count 0 -> là yêu cầu cắt
    // Để đơn giản, ta kiểm tra bằng cách so sánh với meal - nếu completion_status != PENDING
    // thì có khả năng là yêu cầu cắt
    const meal = await this.mealRepository.getWithCompletionStatus(
      registration.mealId,
    );

    const isLikelyCancellationRequest =
      meal &&
      meal.completionStatus !== MEAL_COMPLETION_STATUS.PENDING;

    const newStatus = MEAL_REGISTRATION_STATUS.CONFIRMED;
    const confirmed = await this.mealRegistrationRepository.updateStatus(
      id,
      newStatus,
    );

    const actionDetail = isLikelyCancellationRequest
      ? "Duyệt yêu cầu cắt suất ăn"
      : "Xác nhận đăng ký suất ăn";

    await this.logAction(
      LOG_ACTION.ACTION_APPROVE,
      actor,
      `meal_registration:${id}`,
      actionDetail,
      registration,
      confirmed,
    );

    const message = isLikelyCancellationRequest
      ? "Yêu cầu cắt suất ăn của bạn đã được duyệt"
      : "Đăng ký suất ăn của bạn đã được xác nhận";

    await this.notificationService.notifyUser(
      {
        title: message,
        content: `Yêu cầu của bạn cho ngày ${registration.mealDate} đã được xét duyệt.`,
        url: `/meal-registration/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      registration.userId,
    );

    return confirmed;
  }

  // Admin/manager duyệt yêu cầu cắt và thực hiện cắt suất (chuyển sang CANCELLED)
  async approveCancel(id, actor = {}) {
    const registration = await this.get(id);
    assertManagerMealEditable(registration.mealDate, actor);

    // Chỉ admin/manager mới được duyệt
    const isManagement = (actor.roles || []).some((role) =>
      [ROLE.ADMIN, ROLE.MANAGER].includes(role),
    );

    if (!isManagement) {
      throw new AppError(
        "Bạn không có quyền duyệt yêu cầu cắt suất ăn",
        403,
      );
    }

    if (registration.status !== MEAL_REGISTRATION_STATUS.PENDING) {
      throw new AppError(
        "Chỉ yêu cầu chờ duyệt mới có thể được xử lý",
        409,
      );
    }

    const cancelled = await this.mealRegistrationRepository.updateStatus(
      id,
      MEAL_REGISTRATION_STATUS.CANCELLED,
    );

    await this.logAction(
      LOG_ACTION.ACTION_CANCEL,
      actor,
      `meal_registration:${id}`,
      "Duyệt yêu cầu cắt suất ăn và hủy suất",
      registration,
      cancelled,
    );

    await this.notificationService.notifyUser(
      {
        title: "Yêu cầu cắt suất ăn đã được duyệt",
        content: `Suất ăn ngày ${registration.mealDate} của bạn đã được hủy.`,
        url: `/meal-registration/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      registration.userId,
    );

    return cancelled;
  }

  // Admin/manager từ chối yêu cầu cắt (quay lại CONFIRMED)
  async rejectCancel(id, actor = {}) {
    const registration = await this.get(id);
    assertManagerMealEditable(registration.mealDate, actor);

    // Chỉ admin/manager mới được từ chối
    const isManagement = (actor.roles || []).some((role) =>
      [ROLE.ADMIN, ROLE.MANAGER].includes(role),
    );

    if (!isManagement) {
      throw new AppError(
        "Bạn không có quyền từ chối yêu cầu cắt suất ăn",
        403,
      );
    }

    if (registration.status !== MEAL_REGISTRATION_STATUS.PENDING) {
      throw new AppError(
        "Chỉ yêu cầu chờ duyệt mới có thể bị từ chối",
        409,
      );
    }

    const confirmed = await this.mealRegistrationRepository.updateStatus(
      id,
      MEAL_REGISTRATION_STATUS.CONFIRMED,
    );

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `meal_registration:${id}`,
      "Từ chối yêu cầu cắt suất ăn",
      registration,
      confirmed,
    );

    await this.notificationService.notifyUser(
      {
        title: "Yêu cầu cắt suất ăn bị từ chối",
        content: `Yêu cầu cắt suất ăn ngày ${registration.mealDate} của bạn đã bị từ chối. Bạn vẫn được đăng ký ăn trong ngày này.`,
        url: `/meal-registration/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      registration.userId,
    );

    return confirmed;
  }

  // Hủy đăng ký (chủ sở hữu hoặc admin/manager)
  // Logic mới:
  // - Nếu suất đã hoàn thành (COMPLETED) -> không cắt được
  // - Nếu quá giờ hoàn thành meal (completionStatus = COMPLETED) -> không cắt được
  // - Nếu quá giờ kết thúc đăng ký nhưng chưa qua giờ hoàn thành:
  //   * Nhân viên thường -> tạo request (status = pending) để admin duyệt
  //   * Admin/manager -> cắt ngay (status = cancelled)
  async cancel(id, actor = {}) {
    const registration = await this.get(id);

    this.assertOwnerOrManager(registration, actor);
    // Admin không tự cắt suất ăn của chính mình (chỉ cắt hộ người khác với
    // vai trò quản lý - đã được assertOwnerOrManager cho phép ở trên).
    this.assertNotAdminSelfService(registration.userId, actor, "cắt suất");

    if (registration.status === MEAL_REGISTRATION_STATUS.CANCELLED) {
      throw new AppError("Đăng ký này đã bị hủy trước đó", 409);
    }

    // Lấy meal kèm completion_status để kiểm tra thời gian
    const meal = await this.mealRepository.getWithCompletionStatus(
      registration.mealId,
    );
    if (!meal) {
      throw new AppError("Bếp ăn không tồn tại", 404);
    }

    // Kiểm tra điều kiện cắt suất
    const permission = await this.checkCancellationPermission(
      registration,
      meal,
      actor,
    );

    if (!permission.canCancel) {
      throw new AppError(permission.reason, 409);
    }

    // Cắt suất ngay (admin/manager trực tiếp cắt, hoặc nhân viên cắt trước giờ đóng)
    const cancelled = await this.mealRegistrationRepository.updateStatus(
      id,
      MEAL_REGISTRATION_STATUS.CANCELLED,
    );

    await this.logAction(
      LOG_ACTION.ACTION_CANCEL,
      actor,
      `meal_registration:${id}`,
      `Hủy suất ăn ngày ${registration.mealDate}`,
      registration,
      cancelled,
    );

    // Chủ động báo cho quản lý/admin biết để điều chỉnh số suất ăn cần chuẩn bị
    await this.notificationService.notifyRoles(
      {
        title: `Hủy suất ăn ngày ${registration.mealDate}`,
        content: `Nhân viên ${registration.userName || "#" + registration.userId} đã hủy suất ăn ngày ${registration.mealDate}.`,
        url: `/meal-registration/view?id=${id}`,
        createdBy: actor.actorId || null,
      },
      [ROLE.ADMIN, ROLE.MANAGER],
    );

    return cancelled;
  }

  async delete(id, actor = {}) {
    const registration = await this.get(id);
    assertManagerMealEditable(registration.mealDate, actor);

    await this.mealRegistrationRepository.delete(id);

    await this.logAction(
      LOG_ACTION.ACTION_DELETE,
      actor,
      `meal_registration:${id}`,
      "Xóa đăng ký suất ăn",
      registration,
      null,
    );

    return true;
  }

  // Tài khoản admin là tài khoản quản lý hệ thống thuần túy, không phải
  // nhân viên tiêu chuẩn ăn thực tế -> không cho phép thao tác đăng
  // ký/cắt suất ăn CHO CHÍNH TÀI KHOẢN ADMIN đó (dù tự thao tác hay admin
  // khác thao tác hộ). Vẫn cho phép admin thao tác hộ cho user khác.
  assertNotAdminSelfService(targetUserId, actor, actionLabel) {
    const isTargetSelf = String(targetUserId) === String(actor.actorId);
    const isAdmin = (actor.roles || []).includes(ROLE.ADMIN);

    if (isTargetSelf && isAdmin) {
      throw new AppError(
        `Tài khoản admin là tài khoản quản lý, không thể tự ${actionLabel} suất ăn`,
        403,
      );
    }
  }

  assertOwnerOrManager(registration, actor) {
    const isOwner = String(registration.userId) === String(actor.actorId);
    const isManagement = (actor.roles || []).some((role) =>
      [ROLE.ADMIN, ROLE.MANAGER].includes(role),
    );

    if (!isOwner && !isManagement) {
      throw new AppError("Bạn không có quyền thao tác trên đăng ký này", 403);
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

module.exports = MealRegistrationService;
