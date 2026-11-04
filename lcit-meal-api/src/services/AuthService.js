const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require('node:crypto');

const USER_STATUS = require("../constants/UserStatus");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");

class AuthService {
  constructor(userRepository, auditLogService) {
    this.userRepository = userRepository;
    this.auditLogService = auditLogService;
  }

  async login(username, password, meta = {}) {
    this.validateLoginData(username, password);

    const user = await this.userRepository.getByUsername(username);

    if (!user) {
      await this.logLoginAttempt(null, `username:${username}`, "failed", meta);
      throw new AppError("Username hoặc password không chính xác", 401);
    }

    if (String(user.status) !== String(USER_STATUS.STATUS_ACTIVE)) {
      await this.logLoginAttempt(user.id, `user:${user.id}`, "failed", meta);
      throw new AppError("Tài khoản không hoạt động", 403);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      await this.logLoginAttempt(user.id, `user:${user.id}`, "failed", meta);
      throw new AppError("Username hoặc password không chính xác", 401);
    }

    const accessToken = this.generateAccessToken(user);

    // Only the newest device keeps its persistent session.
    await this.userRepository.updateAccessToken(user.id, accessToken);
    user.accessToken = accessToken;

    await this.logLoginAttempt(user.id, `user:${user.id}`, "success", meta);

    return {
      user,
      accessToken,
    };
  }

  validateLoginData(username, password) {
    if (!username) {
      throw new AppError("username là bắt buộc", 400);
    }

    if (!password) {
      throw new AppError("password là bắt buộc", 400);
    }
  }

  async logout(userId, token) {
    const user = await this.userRepository.get(userId);

    if (!user) {
      throw new AppError("Người dùng không tồn tại", 404);
    }

    if (!token) throw new AppError('Token không tồn tại', 401);
    // A delayed logout from the old device must not revoke a newer login.
    await this.userRepository.revokeAccessToken(userId, token);

    return true;
  }

  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        jti: crypto.randomUUID(),
      },

      process.env.JWT_SECRET,
    );
  }

  // Ghi log mỗi lần đăng nhập (thành công hoặc thất bại) vào audit_log.
  // Không được để lỗi ghi log làm gãy luồng đăng nhập chính.
  async logLoginAttempt(actorId, target, result, meta) {
    try {
      await this.auditLogService.create({
        logActor: actorId,
        logAction: LOG_ACTION.ACTION_LOGIN,
        logTarget: target,
        logResult: result,
        logDetail:
          result === "success" ? "Đăng nhập thành công" : "Đăng nhập thất bại",
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
        status: result,
      });
    } catch (error) {
      console.error("Ghi audit log đăng nhập thất bại:", error.message);
    }
  }
}

module.exports = AuthService;
