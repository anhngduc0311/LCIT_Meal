const express = require("express");

const ROLE = require("../constants/Role");

// Xem lịch bếp ăn: mọi nhân sự nghiệp vụ (admin/manager/employee), trừ bếp (bếp chỉ xem dashboard).
// Tạo/sửa/hủy bếp ăn: chỉ admin + manager.
const mealRoutes = (mealController, authMiddleware, authorize) => {
  const router = express.Router();

  router.use(authMiddleware);

  // GET /api/meals
  router.get("/", authorize(...ROLE.STAFF_ROLES), mealController.list);

  // GET /api/meals/filter?from&to&status&isCancelled
  router.get("/filter", authorize(...ROLE.STAFF_ROLES), mealController.filter);

  // GET /api/meals/:id
  router.get('/guests', authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN), mealController.guestCounts);
  router.patch('/:id/guests', authorize(ROLE.ADMIN, ROLE.MANAGER), mealController.addGuests);
  router.patch('/:id/guests/remove', authorize(ROLE.ADMIN, ROLE.MANAGER), mealController.removeGuests);

  router.get("/:id", authorize(...ROLE.STAFF_ROLES), mealController.get);

  // GET /api/meals/:id/summary - số suất ăn cần chuẩn bị (join meal_registration)
  router.get(
    "/:id/summary",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealController.summary,
  );

  // POST /api/meals
  router.post("/", authorize(ROLE.ADMIN, ROLE.MANAGER), mealController.create);

  // PUT /api/meals/:id
  router.put(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealController.update,
  );

  // PATCH /api/meals/:id/cancel - hủy bếp ăn, tự động báo cho user đã đăng ký
  router.patch(
    "/:id/cancel",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealController.cancel,
  );

  // PATCH /api/meals/:id/restore - mở lại bếp ăn đã hủy nhầm
  router.patch(
    "/:id/restore",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    mealController.restore,
  );

  // DELETE /api/meals/:id
  router.delete("/:id", authorize(ROLE.ADMIN), mealController.delete);

  return router;
};

module.exports = mealRoutes;
