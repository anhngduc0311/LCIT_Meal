const ApiResponse = require("../ultis/ApiResponse");
const paginate = require("../ultis/paginate");
const { getActor } = require("../ultis/actor");

class MealOptionController {
  constructor(mealOptionService) {
    this.mealOptionService = mealOptionService;
  }

  list = async (req, res, next) => {
    try {
      const mealOptions = await this.mealOptionService.list();

      return ApiResponse.success(res, paginate(mealOptions, req.query));
    } catch (error) {
      next(error);
    }
  };

  // Danh sách yêu cầu hủy ăn của chính người dùng đang đăng nhập
  listMine = async (req, res, next) => {
    try {
      const mealOptions = await this.mealOptionService.listByUser(
        req.user.id,
      );

      return ApiResponse.success(res, mealOptions);
    } catch (error) {
      next(error);
    }
  };

  get = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.getForActor(req.params.id, getActor(req));

      return ApiResponse.success(res, mealOption);
    } catch (error) {
      next(error);
    }
  };

  filter = async (req, res, next) => {
    try {
      const { userId, type, status } = req.query;

      const mealOptions = await this.mealOptionService.filter(
        userId,
        type,
        status,
      );

      return ApiResponse.success(res, paginate(mealOptions, req.query));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.create(
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, mealOption, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.update(
        req.params.id,
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, mealOption);
    } catch (error) {
      next(error);
    }
  };

  approve = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.approve(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, mealOption);
    } catch (error) {
      next(error);
    }
  };

  reject = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.reject(
        req.params.id,
        req.body ? req.body.note : null,
        getActor(req),
      );

      return ApiResponse.success(res, mealOption);
    } catch (error) {
      next(error);
    }
  };

  // "Xác nhận đăng ký ăn lại" - kết thúc sớm 1 yêu cầu cắt suất vĩnh
  // viễn/theo khoảng ngày đã duyệt.
  reactivate = async (req, res, next) => {
    try {
      const mealOption = await this.mealOptionService.reactivate(
        req.params.id,
        getActor(req),
        req.body?.fromDate,
      );

      return ApiResponse.success(res, mealOption);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.mealOptionService.delete(req.params.id, getActor(req));

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MealOptionController;
