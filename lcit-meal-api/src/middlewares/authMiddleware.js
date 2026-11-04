const jwt = require("jsonwebtoken");

const UserRepository = require("../repos/UserRepository");
const ApiResponse = require("../ultis/ApiResponse");
const USER_STATUS = require("../constants/UserStatus");

const userRepository = new UserRepository();

/**
 * Middleware xác thực (Authentication).
 * - Kiểm tra header Authorization: Bearer <token>
 * - Verify JWT
 * - Đối chiếu access_token còn hiệu lực trong DB (cho phép thu hồi token khi logout)
 * - Gắn req.user (kèm roles) cho các middleware/controller phía sau dùng
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return ApiResponse.error(res, "Token không tồn tại", 401);
    }

    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return ApiResponse.error(res, "Token không hợp lệ", 401);
    }

    const token = parts[1];

    // Phiên không giới hạn thời gian, kể cả token 7 ngày đã lưu từ bản cũ.
    // Vẫn kiểm tra chữ ký, trạng thái tài khoản và token hiện tại trong DB.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });

    const user = await userRepository.get(decoded.id);

    if (!user) {
      return ApiResponse.error(res, "User không tồn tại", 401);
    }

    if (String(user.status) !== String(USER_STATUS.STATUS_ACTIVE)) {
      return ApiResponse.error(res, "Tài khoản không hoạt động", 401);
    }

    if (user.accessToken !== token) {
      return ApiResponse.error(res, "Token đã bị thu hồi", 401);
    }

    req.user = user;
    req.token = token;

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return ApiResponse.error(res, "Token không hợp lệ", 401);
    }

    // Lỗi DB/server không có nghĩa là phiên đã bị thu hồi.
    // Trả lỗi server qua errorMiddleware để app không xóa phiên đăng nhập.
    return next(error);
  }
};

module.exports = authMiddleware;
