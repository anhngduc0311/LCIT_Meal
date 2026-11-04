const express = require("express");

const ROLE = require("../constants/Role");

// Xem toàn bộ yêu cầu: admin + manager (người duyệt).
// Xem/tạo/sửa/hủy yêu cầu của chính mình: mọi user đã đăng nhập.
// Duyệt/từ chối: chỉ admin + manager.
const mealOptionRoutes = (mealOptionController, authMiddleware, authorize) => {
  const router = express.Router();

  router.use(authMiddleware);

  // GET /api/meal-options
  router.get(
    "/",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealOptionController.list,
  );

  // GET /api/meal-options/filter?userId&type&status
  router.get(
    "/filter",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealOptionController.filter,
  );

  // GET /api/meal-options/me - danh sách yêu cầu hủy ăn của chính mình
  router.get("/me", authorize(...ROLE.STAFF_ROLES), mealOptionController.listMine);

  // GET /api/meal-options/:id
  router.get("/:id", authorize(...ROLE.STAFF_ROLES), mealOptionController.get);

  // POST /api/meal-options - tạo yêu cầu hủy ăn cho chính mình
  router.post("/", authorize(...ROLE.STAFF_ROLES), mealOptionController.create);

  // PUT /api/meal-options/:id - sửa yêu cầu còn "pending" của chính mình
  router.put("/:id", authorize(...ROLE.STAFF_ROLES), mealOptionController.update);

  // PATCH /api/meal-options/:id/approve
  router.patch(
    "/:id/approve",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealOptionController.approve,
  );

  // PATCH /api/meal-options/:id/reject
  router.patch(
    "/:id/reject",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealOptionController.reject,
  );

  // PATCH /api/meal-options/:id/reactivate - "Xác nhận đăng ký ăn lại" cho
  // yêu cầu cắt suất vĩnh viễn/theo khoảng ngày đã duyệt.
  router.patch(
    "/:id/reactivate",
    authorize(ROLE.ADMIN),
    mealOptionController.reactivate,
  );

  // DELETE /api/meal-options/:id - hủy yêu cầu còn "pending" của chính mình, hoặc admin xóa bất kỳ
  router.delete("/:id", authorize(...ROLE.STAFF_ROLES), mealOptionController.delete);

  return router;
};

module.exports = mealOptionRoutes;
