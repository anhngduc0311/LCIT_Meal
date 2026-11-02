// Khớp với cột `role`.`code` trong database
const ROLE = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  KITCHEN: "kitchen",
};

// Nhóm nhân sự được đăng ký ăn. Bếp có quyền xem dashboard và thu tiền
// theo các quyền cụ thể tại PaymentRoutes; không được quản lý người dùng
// hay sửa cấu hình thông qua nhóm này.
ROLE.STAFF_ROLES = [ROLE.ADMIN, ROLE.MANAGER, ROLE.EMPLOYEE];

module.exports = ROLE;
