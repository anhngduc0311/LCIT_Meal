const ApiResponse = require("../ultis/ApiResponse");
const { getActor } = require("../ultis/actor");

class MealController {
  removeGuests = async (req, res, next) => {
    try { return ApiResponse.success(res, await this.mealService.removeGuests(req.params.id, req.body, getActor(req))); }
    catch (error) { next(error); }
  };
  guestCounts = async (req, res, next) => {
    try { return ApiResponse.success(res, await this.mealService.guestCounts(req.query.from, req.query.to)); }
    catch (error) { next(error); }
  };
  addGuests = async (req, res, next) => {
    try { return ApiResponse.success(res, await this.mealService.addGuests(req.params.id, req.body, getActor(req))); }
    catch (error) { next(error); }
  };
  constructor(mealService) {
    this.mealService = mealService;
  }

  list = async (req, res, next) => {
    try {
      const meals = await this.mealService.list();

      return ApiResponse.success(res, meals);
    } catch (error) {
      next(error);
    }
  };

  get = async (req, res, next) => {
    try {
      const meal = await this.mealService.get(req.params.id);

      return ApiResponse.success(res, meal);
    } catch (error) {
      next(error);
    }
  };

  filter = async (req, res, next) => {
    try {
      const { from, to, status, isCancelled, page, limit } = req.query;

      // Kiểm tra xem request có yêu cầu phân trang hay không
      if (page || limit) {
        const result = await this.mealService.filterPaginated(
          from,
          to,
          status,
          isCancelled,
          page,
          limit,
        );
        return ApiResponse.success(res, result);
      }

      const meals = await this.mealService.filter(
        from,
        to,
        status,
        isCancelled,
      );

      return ApiResponse.success(res, meals);
    } catch (error) {
      next(error);
    }
  };

  // Số suất ăn cần chuẩn bị trong ngày (join bảng trung gian meal_registration)
  summary = async (req, res, next) => {
    try {
      const summary = await this.mealService.getSummary(req.params.id);

      return ApiResponse.success(res, summary);
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const meal = await this.mealService.create(req.body, getActor(req));

      return ApiResponse.success(res, meal, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const meal = await this.mealService.update(
        req.params.id,
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, meal);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req, res, next) => {
    try {
      const meal = await this.mealService.cancel(
        req.params.id,
        req.body ? req.body.note : null,
        getActor(req),
      );

      return ApiResponse.success(res, meal);
    } catch (error) {
      next(error);
    }
  };

  restore = async (req, res, next) => {
    try {
      const meal = await this.mealService.restore(
        req.params.id,
        getActor(req),
      );

      return ApiResponse.success(res, meal);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.mealService.delete(req.params.id, getActor(req));

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MealController;
