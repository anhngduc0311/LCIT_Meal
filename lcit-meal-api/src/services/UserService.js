const bcrypt = require("bcrypt");
const crypto = require("crypto");

const USER_STATUS = require("../constants/UserStatus");
const ROLE = require("../constants/Role");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");
const normalizePhone = require('../ultis/normalizePhone');

const SALT_ROUNDS = 10;

class UserService {
  constructor(userRepository, roleRepository, auditLogService) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.auditLogService = auditLogService;
  }

  async list() {
    return this.userRepository.list();
  }

  async get(id) {
    const user = await this.userRepository.get(id);

    if (!user) {
      throw new AppError("User không tồn tại", 404);
    }

    return user;
  }

  async filter(query, role, status) {
    return this.userRepository.filter(query, role, status);
  }

  async checkUsername(username, excludeId) {
    const value = String(username || "").trim();
    if (!value)
      return { available: false, message: "Tên đăng nhập là bắt buộc" };
    const exists = await this.userRepository.usernameExists(value, excludeId);
    return exists
      ? { available: false, message: "Tên đăng nhập đã tồn tại" }
      : { available: true, message: null };
  }

  async create(data, actor = {}) {
    await this.validateCreateData(data);
    const phone = await this.preparePhone(data.phone);

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const authKey = crypto.randomBytes(16).toString("hex"); // 32 ký tự, khớp cột auth_key varchar(32)

    const user = await this.userRepository.create({
      fullName: data.fullName,
      phone,
      username: data.username,
      passwordHash,
      authKey,
      accessToken: null,
      status: data.status || USER_STATUS.STATUS_ACTIVE,
      createdBy: actor.actorId || null,
    });

    // Gán role: nếu client chỉ định roleId thì dùng, không thì mặc định là "employee"
    const role = data.roleId
      ? await this.roleRepository.get(data.roleId)
      : await this.roleRepository.getByCode(ROLE.EMPLOYEE);

    if (role) {
      await this.userRepository.assignRole(
        user.id,
        role.id,
        actor.actorId || null,
      );
    }

    const createdUser = await this.userRepository.get(user.id);

    await this.logAction(
      LOG_ACTION.ACTION_CREATE,
      actor,
      `user:${user.id}`,
      "Tạo người dùng mới",
      null,
      createdUser,
    );

    return createdUser;
  }

  async createBatch(rows, actor = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError("Danh sách người dùng không hợp lệ", 400);
    }

    const normalized = rows.map((row, index) => ({
      rowNumber: index + 1,
      fullName: String(row.fullName || "").trim(),
      phone: row.phone,
      username: String(row.username || "").trim(),
      password: String(row.password || ""),
      roleId: row.roleId,
      roleCode: row.role || row.roleCode,
      status:
        row.status === undefined || row.status === ""
          ? USER_STATUS.STATUS_ACTIVE
          : String(row.status),
    }));
    const errors = [];
    const usernames = new Set();

    for (const row of normalized) {
      if (!row.fullName) errors.push(`Dòng ${row.rowNumber}: thiếu fullName`);
      if (!row.username) errors.push(`Dòng ${row.rowNumber}: thiếu username`);
      if (!row.password) errors.push(`Dòng ${row.rowNumber}: thiếu password`);
      if (!Object.values(USER_STATUS).includes(row.status)) {
        errors.push(`Dòng ${row.rowNumber}: status không hợp lệ`);
      }
      if (usernames.has(row.username.toLowerCase())) {
        errors.push(`Dòng ${row.rowNumber}: username bị trùng trong file`);
      }
      usernames.add(row.username.toLowerCase());
    }

    if (errors.length) throw new AppError(errors.join("; "), 400);

    const existing = await Promise.all(
      normalized.map((row) => this.userRepository.getByUsername(row.username)),
    );
    existing.forEach((user, index) => {
      if (user)
        errors.push(`Dòng ${normalized[index].rowNumber}: username đã tồn tại`);
    });
    if (errors.length) throw new AppError(errors.join("; "), 409);

    const employeeRole = await this.roleRepository.getByCode(ROLE.EMPLOYEE);
    const prepared = [];
    const phones = new Set();
    for (const row of normalized) {
      const phone = await this.preparePhone(row.phone);
      if (phone && phones.has(phone)) throw new AppError(`Dòng ${row.rowNumber}: số điện thoại bị trùng trong file`, 409);
      if (phone) phones.add(phone);
      const role = row.roleId
        ? await this.roleRepository.get(row.roleId)
        : row.roleCode
          ? await this.roleRepository.getByCode(row.roleCode)
          : employeeRole;
      if (!role)
        throw new AppError(`Dòng ${row.rowNumber}: role không tồn tại`, 400);

      prepared.push({
        fullName: row.fullName,
        phone,
        username: row.username,
        passwordHash: await bcrypt.hash(row.password, SALT_ROUNDS),
        authKey: crypto.randomBytes(16).toString("hex"),
        status: row.status,
        roleId: role.id,
        createdBy: actor.actorId || null,
      });
    }

    const userIds = await this.userRepository.createBatch(prepared);
    await this.logAction(
      LOG_ACTION.ACTION_CREATE,
      actor,
      "users:batch",
      `Import ${userIds.length} người dùng`,
      null,
      { userIds },
    );

    return {
      count: userIds.length,
      users: await Promise.all(
        userIds.map((id) => this.userRepository.get(id)),
      ),
    };
  }

  async validateCreateData(data) {
    if (!data.fullName) {
      throw new AppError("Tên cán bộ không thể để trống", 400);
    }

    if (!data.username) {
      throw new AppError("Tên đăng nhập không thể để trống", 400);
    }

    if (!data.password) {
      throw new AppError("Mật khẩu người dùng không thể để trống", 400);
    }

    const existingUser = await this.userRepository.getByUsername(data.username);

    if (existingUser) {
      throw new AppError("Tên người dùng đã tồn tại", 409);
    }
  }

  async update(id, data, actor = {}) {
    const user = await this.userRepository.get(id);

    if (!user) {
      throw new AppError("Tài khoản không tồn tại", 404);
    }

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, SALT_ROUNDS)
      : user.passwordHash;

    const updatedUser = await this.userRepository.update(id, {
      fullName: data.fullName || user.fullName,
      phone: data.phone === undefined ? user.phone : await this.preparePhone(data.phone, id),
      username: data.username || user.username,
      passwordHash,
      status: data.status || user.status,
      updatedBy: actor.actorId || null,
    });

    // Cho phép đổi vai trò khi cập nhật người dùng (nếu client gửi roleId)
    if (data.roleId) {
      await this.userRepository.setRole(id, data.roleId, actor.actorId || null);
    }

    const finalUser = data.roleId
      ? await this.userRepository.get(id)
      : updatedUser;

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `user:${id}`,
      "Cập nhật người dùng",
      user,
      finalUser,
    );

    return finalUser;
  }

  // Tự cập nhật hồ sơ của chính mình (đổi họ tên / mật khẩu). Khác với
  // update() ở trên: KHÔNG cho phép tự đổi roleId hay status, tránh việc
  // một nhân viên tự nâng quyền hoặc tự kích hoạt lại tài khoản của mình.
  async updateOwnProfile(userId, data, actor = {}) {
    const user = await this.userRepository.get(userId);

    if (!user) {
      throw new AppError("Tài khoản không tồn tại", 404);
    }

    if (data.password && data.password.length < 6) {
      throw new AppError("Mật khẩu mới phải có ít nhất 6 ký tự", 400);
    }

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, SALT_ROUNDS)
      : user.passwordHash;

    const updatedUser = await this.userRepository.update(userId, {
      fullName: data.fullName || user.fullName,
      phone: data.phone === undefined ? user.phone : await this.preparePhone(data.phone, userId),
      username: user.username,
      passwordHash,
      status: user.status,
      updatedBy: userId,
    });

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `user:${userId}`,
      data.password ? "Tự đổi mật khẩu" : "Tự cập nhật hồ sơ",
      user,
      updatedUser,
    );

    return updatedUser;
  }

  async preparePhone(value, excludeId = null) {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
    const phone = normalizePhone(value);
    if (!phone) throw new AppError('Số điện thoại Việt Nam không hợp lệ. Nhập dạng 0... hoặc +84...', 400);
    if (await this.userRepository.phoneExists(phone, excludeId)) throw new AppError('Số điện thoại đã được dùng cho tài khoản khác.', 409);
    return phone;
  }

  async delete(id, actor = {}) {
    const user = await this.userRepository.get(id);

    if (!user) {
      throw new AppError("Tài khoản không tồn tại", 404);
    }

    await this.userRepository.delete(id, actor.actorId || null);

    await this.logAction(
      LOG_ACTION.ACTION_DELETE,
      actor,
      `user:${id}`,
      "Xóa (mềm) người dùng",
      user,
      null,
    );

    return true;
  }

  async forceDelete(id, actor = {}) {
    const user = await this.userRepository.get(id);

    if (!user) {
      throw new AppError("Tài khoản không tồn tại", 404);
    }

    await this.userRepository.forceDelete(id);

    await this.logAction(
      LOG_ACTION.ACTION_FORCE_DELETE,
      actor,
      `user:${id}`,
      "Xóa vĩnh viễn người dùng",
      user,
      null,
    );

    return true;
  }

  // Ghi log thao tác thay đổi dữ liệu người dùng vào audit_log.
  // Không được để lỗi ghi log làm gãy luồng nghiệp vụ chính.
  async logAction(action, actor, target, detail, oldData, newData) {
    try {
      await this.auditLogService.create({
        logActor: actor.actorId || null,
        logAction: action,
        logTarget: target,
        logResult: "success",
        logDetail: detail,
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
        status: "success",
        oldData,
        newData,
      });
    } catch (error) {
      console.error("Ghi audit log thất bại:", error.message);
    }
  }
}

module.exports = UserService;
