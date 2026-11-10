const NOTIFICATION_STATUS = require("../constants/Notification");
const AppError = require("../ultis/AppError");

class NotificationService {
  constructor(notificationRepository, userRepository = null) {
    this.notificationRepository = notificationRepository;
    // userRepository chỉ cần khi dùng notifyRoles() (tra cứu user theo role
    // qua bảng trung gian user_role). Cho phép null để không phá vỡ nơi
    // nào đang khởi tạo NotificationService mà không truyền userRepository.
    this.userRepository = userRepository;
  }

  async list() {
    return this.notificationRepository.list();
  }

  async get(id) {
    const notification = await this.notificationRepository.get(id);

    if (!notification || String(notification.status) === "0") {
      throw new AppError("Notification không tồn tại", 404);
    }

    return notification;
  }

  async filter(query, status) {
    return this.notificationRepository.filter(query, status);
  }
  
  async create(data) {
    this.validateCreateData(data);

    return this.notificationRepository.create({
      title: data.title,

      content: data.content,

      url: data.url || null,

      status: data.status || NOTIFICATION_STATUS.ACTIVE,

      createdBy: data.createdBy || null,
    });
  }

  validateCreateData(data) {
    if (!data.title) {
      throw new AppError("title là bắt buộc", 400);
    }

    if (!data.content) {
      throw new AppError("content là bắt buộc", 400);
    }
  }

  async update(id, data) {
    await this.get(id);

    return this.notificationRepository.update(id, data);
  }

  async delete(id, updatedBy) {
    if (!(await this.notificationRepository.get(id))) {
      throw new AppError("Notification không tồn tại", 404);
    }

    return this.notificationRepository.delete(id, updatedBy);
  }

  // ===== Gửi thông báo tới danh sách người nhận cụ thể (bảng trung gian notification_recipient) =====

  // Tạo 1 notification rồi gửi tới danh sách userId chỉ định.
  // Nếu không truyền userIds (hoặc mảng rỗng) -> broadcast cho toàn bộ user đang active.
  async createForUsers(data, userIds) {
    this.validateCreateData(data);

    let recipientIds = userIds;

    if ((!recipientIds || recipientIds.length === 0) && this.userRepository) {
      recipientIds = await this.userRepository.getAllActiveIds();
    }

    return this.notificationRepository.createWithRecipients({
      title: data.title,
      content: data.content,
      url: data.url || null,
      status: data.status || NOTIFICATION_STATUS.ACTIVE,
      createdBy: data.createdBy || null,
    }, recipientIds || []);
  }

  async getImageUrl(id, userId, canManage) {
    const notification = await this.get(id);
    if (!canManage) {
      const recipients = await this.notificationRepository.getRecipientUserIds(id);
      if (!recipients.some(recipient => String(recipient) === String(userId))) {
        throw new AppError("Không tìm thấy ảnh đính kèm", 404);
      }
    }
    return notification.url;
  }

  // Gửi thông báo cho toàn bộ user thuộc 1 (hoặc nhiều) role - vd: báo cho
  // admin + manager mỗi khi có yêu cầu hủy ăn cần duyệt.
  async notifyRoles(data, roleCodes) {
    if (!this.userRepository) {
      throw new AppError(
        "NotificationService cần userRepository để gửi thông báo theo role",
        500,
      );
    }

    const userIds = await this.userRepository.getIdsByRoleCodes(roleCodes);

    return this.createForUsers(data, userIds);
  }

  // Gửi thông báo cho 1 user cụ thể - vd: báo kết quả duyệt/từ chối yêu cầu của chính họ.
  async notifyUser(data, userId) {
    return this.createForUsers(data, [userId]);
  }

  // Danh sách notification của user hiện tại (join qua bảng trung gian notification_recipient)
  async listForUser(userId, onlyUnseen = false) {
    return this.notificationRepository.listForUser(userId, onlyUnseen);
  }

  async countUnseenForUser(userId) {
    return this.notificationRepository.countUnseenForUser(userId);
  }

  // Đánh dấu đã xem 1 notification - chỉ tác động đến bản ghi recipient của đúng user đang gọi API
  async markSeen(notificationId, userId) {
    const updated = await this.notificationRepository.markSeen(
      notificationId,
      userId,
    );

    if (!updated) {
      throw new AppError(
        "Notification không tồn tại hoặc không thuộc về bạn",
        404,
      );
    }

    return true;
  }

  async markAllSeenForUser(userId) {
    return this.notificationRepository.markAllSeenForUser(userId);
  }
}

module.exports = NotificationService;
