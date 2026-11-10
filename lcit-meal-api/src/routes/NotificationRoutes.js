const express = require("express");
const multer = require("multer");

const ROLE = require("../constants/Role");
const AppError = require("../ultis/AppError");

const receiveImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, fields: 1 },
}).single("image");

// Xem thông báo: mọi nhân sự nghiệp vụ, trừ bếp (bếp chỉ xem dashboard).
// Tạo/sửa/xóa thông báo: chỉ admin + manager (người phát thông báo).
const notificationRoutes = (notificationController, authMiddleware, authorize) => {
  const router = express.Router();

  router.use(authMiddleware);

  // GET /api/notifications
  router.get("/", authorize(...ROLE.STAFF_ROLES), notificationController.list);

  // GET /api/notifications/filter
  router.get("/filter", authorize(...ROLE.STAFF_ROLES), notificationController.filter);

  // ===== Thông báo của riêng người dùng đang đăng nhập (bảng trung gian notification_recipient) =====
  // Đặt TRƯỚC "/:id" để không bị "/:id" nuốt mất các path tĩnh bên dưới.

  // GET /api/notifications/me?unseen=1
  router.get("/me", authorize(...ROLE.STAFF_ROLES), notificationController.listMine);

  // GET /api/notifications/me/unseen-count
  router.get(
    "/me/unseen-count",
    authorize(...ROLE.STAFF_ROLES),
    notificationController.unseenCount,
  );

  // PATCH /api/notifications/me/seen-all
  router.patch(
    "/me/seen-all",
    authorize(...ROLE.STAFF_ROLES),
    notificationController.markAllSeen,
  );

  // GET /api/notifications/:id
  router.get("/:id", authorize(...ROLE.STAFF_ROLES), notificationController.get);
  router.get("/:id/image", authorize(...ROLE.STAFF_ROLES), notificationController.getImage);

  // PATCH /api/notifications/:id/seen
  router.patch("/:id/seen", authorize(...ROLE.STAFF_ROLES), notificationController.markSeen);

  // POST /api/notifications
  router.post(
    "/",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    notificationController.create,
  );

  // POST /api/notifications/send - tạo và gửi tới người nhận cụ thể / broadcast
  router.post(
    "/send",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    (req, res, next) => receiveImage(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        return next(new AppError("Ảnh đính kèm không hợp lệ hoặc vượt quá 5 MB", 400));
      }
      next(error);
    }),
    notificationController.send,
  );

  // PUT /api/notifications/:id
  router.put(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    notificationController.update,
  );

  // DELETE /api/notifications/:id
  router.delete(
    "/:id",
    authorize(ROLE.ADMIN, ROLE.MANAGER),
    notificationController.delete,
  );

  return router;
};

module.exports = notificationRoutes;
