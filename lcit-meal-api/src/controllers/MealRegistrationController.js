const ApiResponse = require("../ultis/ApiResponse");
const paginate = require("../ultis/paginate");
const { sendExcel } = require("../ultis/excelExport");
const { getActor } = require("../ultis/actor");

class MealRegistrationController {
  constructor(mealRegistrationService) {
    this.mealRegistrationService = mealRegistrationService;
  }

  window = async (req, res, next) => {
    try {
      return ApiResponse.success(res, await this.mealRegistrationService.getRegistrationWindow());
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const registrations = await this.mealRegistrationService.list();

      return ApiResponse.success(res, paginate(registrations, req.query));
    } catch (error) {
      next(error);
    }
  };

  // Danh sách đăng ký ăn của chính người dùng đang đăng nhập
  listMine = async (req, res, next) => {
    try {
      const registrations = await this.mealRegistrationService.listByUser(
        req.user.id,
      );

      return ApiResponse.success(res, paginate(registrations, req.query));
    } catch (error) {
      next(error);
    }
  };

  // Danh sách toàn bộ user đăng ký ăn 1 ngày (bếp dùng để biết số suất cần nấu)
  listByMeal = async (req, res, next) => {
    try {
      const registrations = await this.mealRegistrationService.listByMeal(
        req.params.mealId,
      );

      return ApiResponse.success(res, paginate(registrations, req.query));
    } catch (error) {
      next(error);
    }
  };

  summaryByMeal = async (req, res, next) => {
    try {
      const summary = await this.mealRegistrationService.getSummaryByMeal(
        req.params.mealId,
      );

      return ApiResponse.success(res, summary);
    } catch (error) {
      next(error);
    }
  };

  get = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.getForActor(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  filter = async (req, res, next) => {
    try {
      const { userId, mealId, status, from, to, page, limit } = req.query;

      // Kiểm tra xem request có yêu cầu phân trang hay không
      if (page || limit) {
        const result = await this.mealRegistrationService.filterPaginated(
          userId,
          mealId,
          status,
          from,
          to,
          page,
          limit,
        );
        return ApiResponse.success(res, result);
      }

      const registrations = await this.mealRegistrationService.filter(
        userId,
        mealId,
        status,
        from,
        to,
      );

      return ApiResponse.success(res, paginate(registrations, req.query));
    } catch (error) {
      next(error);
    }
  };

  // GET /api/meal-registrations/export?userId&mealId&status&from&to - xuất Excel
  export = async (req, res, next) => {
    try {
      const { userId, mealId, status, from, to } = req.query;

      const registrations = await this.mealRegistrationService.filter(
        userId,
        mealId,
        status,
        from,
        to,
      );

      const STATUS_LABEL = {
        confirmed: "Đã xác nhận",
        pending: "Chờ xác nhận",
        cancelled: "Đã hủy",
      };

      await sendExcel(
        res,
        `dang-ky-an_${from || "all"}_${to || "all"}`,
        "Đăng ký suất ăn",
        [
          { header: "Mã", key: "id", width: 8 },
          { header: "Cán bộ", key: "userName", width: 28 },
          { header: "Ngày ăn", key: "mealDate", width: 14 },
          { header: "Số khách", key: "guestCount", width: 12 },
          { header: "Trạng thái", key: "statusLabel", width: 16 },
        ],
        registrations.map((r) => ({
          id: r.id,
          userName: r.userName,
          mealDate: r.mealDate,
          guestCount: r.guestCount,
          statusLabel: STATUS_LABEL[r.status] || r.status,
        })),
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.create(
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, registration, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.update(
        req.params.id,
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  confirm = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.confirm(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.cancel(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  approveCancel = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.approveCancel(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  rejectCancel = async (req, res, next) => {
    try {
      const registration = await this.mealRegistrationService.rejectCancel(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, registration);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.mealRegistrationService.delete(req.params.id, getActor(req));

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MealRegistrationController;
