const express = require("express");

const ROLE = require("../constants/Role");

// Xem/đối soát thanh toán: admin + manager + kitchen.
// Xem lịch sử thanh toán của chính mình: mọi user đã đăng nhập.
// Xác nhận đã thanh toán: admin + manager + kitchen.
// Tạo/sửa: admin + manager; xóa: admin.
const paymentRoutes = (paymentController, authMiddleware, authorize) => {
  const router = express.Router();

  router.use(authMiddleware);
  router.get('/monthly-board', authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN), paymentController.monthlyBoard);

  // GET /api/payments
  router.get(
    "/",
    authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN),
    paymentController.list,
  );

  // GET /api/payments/filter?userId&status&from&to
  router.get(
    "/filter",
    authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN),
    paymentController.filter,
  );

  // GET /api/payments/export?userId&status&from&to - xuất Excel (đặt trước "/:id")
  router.get(
    "/export",
    authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN),
    paymentController.export,
  );

  // GET /api/payments/me - lịch sử thanh toán của chính mình
  router.get("/me", authorize(...ROLE.STAFF_ROLES), paymentController.listMine);
  router.get('/me/ledger', authorize(...ROLE.STAFF_ROLES), paymentController.mealLedgerMine);

  // GET /api/payments/:id - chỉ admin/manager xem theo id bất kỳ (nhân viên tự xem qua /me)
  router.get(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN),
    paymentController.get,
  );

  // POST /api/payments - lập hóa đơn cho 1 nhân viên
  router.post("/", authorize(ROLE.ADMIN, ROLE.MANAGER), paymentController.create);

  // PUT /api/payments/:id
  router.put(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    paymentController.update,
  );

  // PATCH /api/payments/:id/mark-paid - xác nhận đã thanh toán
  router.patch(
    "/:id/mark-paid",
    authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN),
    paymentController.markPaid,
  );

  // DELETE /api/payments/:id
  router.delete("/:id", authorize(ROLE.ADMIN), paymentController.delete);

  return router;
};

module.exports = paymentRoutes;
