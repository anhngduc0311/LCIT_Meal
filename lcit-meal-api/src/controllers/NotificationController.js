const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const ApiResponse = require("../ultis/ApiResponse");
const AppError = require("../ultis/AppError");
const paginate = require("../ultis/paginate");
const ROLE = require("../constants/Role");

const imageDir = path.resolve(__dirname, "../../user_data/notification-images");
const imagePathPattern = /^\/notification-images\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/;

function imageExtension(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new AppError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP", 400);
}

class NotificationController {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  list = async (req, res, next) => {
    try {
      const notifications = await this.notificationService.list();

      return ApiResponse.success(res, paginate(notifications, req.query));
    } catch (error) {
      next(error);
    }
  };

  get = async (req, res, next) => {
    try {
      const notification = await this.notificationService.get(req.params.id);

      return ApiResponse.success(res, notification);
    } catch (error) {
      next(error);
    }
  };

  filter = async (req, res, next) => {
    try {
      const { query, status } = req.query;

      const notifications = await this.notificationService.filter(
        query,
        status,
      );

      return ApiResponse.success(res, paginate(notifications, req.query));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const notification = await this.notificationService.create({
        ...req.body,
        createdBy: req.user.id,
      });

      return ApiResponse.success(res, notification, 201);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/notifications/send
  // Tạo thông báo và gửi tới người nhận cụ thể (body.userIds), hoặc broadcast
  // cho toàn bộ user đang active nếu không truyền userIds (dùng cho màn hình
  // "Quản lý thông báo" phía admin: gửi 1 người hoặc "Tất cả người dùng").
  send = async (req, res, next) => {
    let uploadedFile;
    let notification;
    try {
      let payload = req.body;
      if (req.is("multipart/form-data")) {
        try {
          payload = JSON.parse(req.body.payload);
        } catch {
          throw new AppError("Nội dung thông báo không hợp lệ", 400);
        }
        if (!payload || typeof payload.title !== "string" || !payload.title.trim() ||
          typeof payload.content !== "string" || !payload.content.trim() ||
          (payload.userIds !== undefined && (!Array.isArray(payload.userIds) ||
            !payload.userIds.every(id => Number.isSafeInteger(id) && id > 0)))) {
          throw new AppError("Nội dung hoặc người nhận thông báo không hợp lệ", 400);
        }
        if (!req.file) throw new AppError("Chưa chọn ảnh đính kèm", 400);
        const filename = randomUUID() + "." + imageExtension(req.file.buffer);
        await fs.mkdir(imageDir, { recursive: true, mode: 0o700 });
        uploadedFile = path.join(imageDir, filename);
        await fs.writeFile(uploadedFile, req.file.buffer, { flag: "wx", mode: 0o600 });
        payload.url = "/notification-images/" + filename;
      }
      const { userIds, ...data } = payload;
      notification = await this.notificationService.createForUsers(
        { ...data, createdBy: req.user.id },
        userIds,
      );

      return ApiResponse.success(res, notification, 201);
    } catch (error) {
      if (uploadedFile && !notification) {
        await fs.rm(uploadedFile, { force: true }).catch(cleanupError => console.error(cleanupError));
      }
      next(error);
    }
  };

  getImage = async (req, res, next) => {
    try {
      const canManage = req.user.roles.some(role => role.code === ROLE.ADMIN || role.code === ROLE.MANAGER);
      const url = await this.notificationService.getImageUrl(req.params.id, req.user.id, canManage);
      const filename = imagePathPattern.exec(url)?.[1];
      if (!filename) throw new AppError("Không tìm thấy ảnh đính kèm", 404);
      res.set("Cache-Control", "private, no-store");
      res.set("X-Content-Type-Options", "nosniff");
      res.sendFile(filename, { root: imageDir, cacheControl: false }, (error) => {
        if (error) next(error.status === 404 ? new AppError("Không tìm thấy ảnh đính kèm", 404) : error);
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const notification = await this.notificationService.update(
        req.params.id,
        { ...req.body, updatedBy: req.user.id },
      );

      return ApiResponse.success(res, notification);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.notificationService.delete(req.params.id, req.user.id);

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };

  // ===== Endpoint dựa trên bảng trung gian notification_recipient =====

  // Danh sách thông báo của chính người dùng đang đăng nhập.
  // ?unseen=1 để chỉ lấy thông báo chưa đọc.
  listMine = async (req, res, next) => {
    try {
      const onlyUnseen = req.query.unseen === "1" || req.query.unseen === "true";

      const notifications = await this.notificationService.listForUser(
        req.user.id,
        onlyUnseen,
      );

      return ApiResponse.success(res, paginate(notifications, req.query));
    } catch (error) {
      next(error);
    }
  };

  unseenCount = async (req, res, next) => {
    try {
      const total = await this.notificationService.countUnseenForUser(
        req.user.id,
      );

      return ApiResponse.success(res, { total });
    } catch (error) {
      next(error);
    }
  };

  markSeen = async (req, res, next) => {
    try {
      await this.notificationService.markSeen(req.params.id, req.user.id);

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };

  markAllSeen = async (req, res, next) => {
    try {
      await this.notificationService.markAllSeenForUser(req.user.id);

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = NotificationController;
