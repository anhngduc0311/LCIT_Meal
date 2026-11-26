const express = require("express");
const multer = require("multer");

const ROLE = require("../constants/Role");
const AppError = require("../ultis/AppError");

const paymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new AppError("Chỉ hỗ trợ ảnh định dạng PNG, JPG hoặc WEBP", 400));
    }
  },
}).single("file");

// Xem/đối soát thanh toán: admin + manager + kitchen.
// Xem lịch sử thanh toán của chính mình: mọi user đã đăng nhập.
// Xác nhận đã thanh toán: admin + manager + kitchen.
// Tạo/sửa: admin + manager; xóa: admin.
const paymentRoutes = (paymentController, authMiddleware, authorize) => {
  const router = express.Router();

  router.use(authMiddleware);
  router.get('/monthly-board', authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN), paymentController.monthlyBoard);
  router.post('/monthly-board/export', authorize(ROLE.ADMIN, ROLE.MANAGER, ROLE.KITCHEN), paymentController.exportMonthlyBoard);

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

  // POST /api/payments/:id/proof - nhân viên gửi ảnh xác nhận đã chuyển khoản
  router.post(
    "/:id/proof",
    authorize(...ROLE.STAFF_ROLES),
    (req, res, next) =>
      paymentProofUpload(req, res, (error) => {
        if (error instanceof multer.MulterError) {
          return next(
            new AppError("Ảnh chuyển khoản không hợp lệ hoặc vượt quá 5 MB", 400),
          );
        }
        next(error);
      }),
    paymentController.submitProof,
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
