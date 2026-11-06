const express = require("express");

const ROLE = require("../constants/Role");

// Xem toàn bộ đăng ký: admin + manager.
// Đăng ký/xem/hủy đăng ký của chính mình: mọi user đã đăng nhập.
// Xác nhận đăng ký đang chờ: admin + manager.
const mealRegistrationRoutes = (
  mealRegistrationController,
  authMiddleware,
  authorize,
) => {
  const router = express.Router();

  router.use(authMiddleware);

  // GET /api/meal-registrations
  router.get(
    "/",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.list,
  );

  // GET /api/meal-registrations/filter?userId&mealId&status&from&to
  router.get(
    "/filter",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.filter,
  );

  // GET /api/meal-registrations/me - đăng ký ăn của chính mình
  router.get("/me", authorize(...ROLE.STAFF_ROLES), mealRegistrationController.listMine);

  // Keep named paths before /:id so "window" never reaches the integer ID query.
  router.get("/window", authorize(...ROLE.STAFF_ROLES), mealRegistrationController.window);

  // GET /api/meal-registrations/meal/:mealId - toàn bộ user đăng ký ăn 1 ngày
  router.get(
    "/meal/:mealId",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.listByMeal,
  );

  // GET /api/meal-registrations/meal/:mealId/summary - tổng số suất + khách cần chuẩn bị
  router.get(
    "/meal/:mealId/summary",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.summaryByMeal,
  );

  // GET /api/meal-registrations/export?userId&mealId&status&from&to - xuất Excel
  router.get(
    "/export",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.export,
  );

  // GET /api/meal-registrations/:id
  router.get("/:id", authorize(...ROLE.STAFF_ROLES), mealRegistrationController.get);

  // POST /api/meal-registrations - đăng ký ăn cho chính mình
  router.post("/", authorize(...ROLE.STAFF_ROLES), mealRegistrationController.create);

  // PUT /api/meal-registrations/:id - sửa số lượng khách của đăng ký
  router.put("/:id", authorize(...ROLE.STAFF_ROLES), mealRegistrationController.update);

  // PATCH /api/meal-registrations/:id/confirm - xác nhận đăng ký đang chờ (vd: kèm khách)
  router.patch(
    "/:id/confirm",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.confirm,
  );

  // PATCH /api/meal-registrations/:id/cancel - hủy đăng ký của chính mình (hoặc admin/manager hủy hộ)
  router.patch(
    "/:id/cancel",
    authorize(...ROLE.STAFF_ROLES),
    mealRegistrationController.cancel,
  );

  // PATCH /api/meal-registrations/:id/approve-cancel - duyệt yêu cầu cắt (chuyển PENDING -> CANCELLED)
  router.patch(
    "/:id/approve-cancel",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.approveCancel,
  );

  // PATCH /api/meal-registrations/:id/reject-cancel - từ chối yêu cầu cắt (chuyển PENDING -> CONFIRMED)
  router.patch(
    "/:id/reject-cancel",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.rejectCancel,
  );

  // DELETE /api/meal-registrations/:id
  router.delete(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealRegistrationController.delete,
  );

  return router;
};

module.exports = mealRegistrationRoutes;
