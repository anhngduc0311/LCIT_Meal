// Ma trận quyền theo role, khớp với authorize(...) ở backend:
//   - Cán bộ (employee): đăng ký/cắt suất ăn, xem lịch, hồ sơ cá nhân (kèm thanh toán của mình)
//   - Quản lý (manager): quyền của cán bộ + quản lý người dùng, duyệt yêu cầu,
//     thông báo, báo cáo/thanh toán
//   - Bếp (kitchen): CHỈ xem trang chủ (dashboard) để biết số suất cần chuẩn bị
//   - Admin: toàn quyền
//
// Dùng CHUNG cho cả ProtectedRoute (App.tsx) và menu điều hướng
// (AppSidebar.tsx) để 2 nơi này không bị định nghĩa lệch nhau - đây chính là
// nguyên nhân trước đó khiến sidebar hiển thị link mà user bấm vào bị đá
// thẳng về trang chủ (menu không lọc theo role, trong khi route thì có).
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  KITCHEN: "kitchen",
} as const;

export const PAYMENT_ONLY = [ROLES.EMPLOYEE, ROLES.MANAGER];
export const STAFF = [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE];
export const MANAGER_UP = [ROLES.ADMIN, ROLES.MANAGER];
export const ADMIN_ONLY = [ROLES.ADMIN];

// Cán bộ thực sự ăn suất ăn và tự đăng ký/cắt suất cho chính mình (quản lý
// vẫn là cán bộ, chỉ có thêm quyền quản lý). KHÔNG bao gồm admin: admin là
// tài khoản quản trị hệ thống thuần túy, không tự đăng ký/cắt suất ăn/thanh
// toán cho bản thân (chỉ đăng ký/cắt suất HỘ người khác qua trang "Lịch ăn").
export const SELF_MEAL_ROLES = [ROLES.MANAGER, ROLES.EMPLOYEE];

// Trang chủ mặc định khi đăng nhập là trang "Đăng ký / Cắt suất ăn" (dùng
// cho App.tsx quyết định route "/"). Admin và bếp vẫn vào Dashboard tổng quan.
export const isSelfMealRole = (roleCodes: string[]) =>
  SELF_MEAL_ROLES.some((role) => roleCodes.includes(role));

// The shared kitchen-management account does not receive personal meals.
export const PERSONAL_MEAL_PATHS = ["/meal-registration", "/my-statistics", "/my-payments"];
export const canUsePersonalMeals = (username: string | undefined, roleCodes: string[]) =>
  username?.trim().toLowerCase() !== "quanly"
  && !roleCodes.includes(ROLES.ADMIN)
  && isSelfMealRole(roleCodes);

export const homeView = (username: string | undefined, roleCodes: string[]) =>
  canUsePersonalMeals(username, roleCodes) ? "personal" : "dashboard";

// Không truyền allowedRoles (undefined/[]) -> ai đăng nhập cũng vào được
// (khớp hành vi hiện tại của ProtectedRoute khi không có allowedRoles).
export const hasAnyRole = (
  userRoleCodes: string[],
  allowedRoles?: string[],
) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => userRoleCodes.includes(role));
};
