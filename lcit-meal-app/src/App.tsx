import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import HomeRouter from "./pages/HomeRouter";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { STAFF, MANAGER_UP, ADMIN_ONLY, SELF_MEAL_ROLES } from "./constants/roles";

// Các trang ít dùng ngay khi vừa đăng nhập được tách bundle riêng
// (React.lazy) để giảm dung lượng bundle chính, giúp trang đăng nhập /
// trang chủ tải nhanh hơn.
const MealRegistration = lazy(() => import("./pages/MealRegistration"));
const MealSchedule = lazy(() => import("./pages/MealSchedule"));
const UserManagement = lazy(() => import("./pages/User"));
const SettingManagement = lazy(() => import("./pages/Setting"));
const PermissionManagementLazy = lazy(
  () => import("./pages/Permission"),
);
const NotificationManagementLazy = lazy(
  () => import("./pages/Notification"),
);
const AuditLogManagementLazy = lazy(
  () => import("./pages/AuditLog"),
);
const MealPaymentReportsLazy = lazy(() => import("./pages/Reports"));
const MyMealStatisticsLazy = lazy(
  () => import("./pages/Reports/MyMealStatistics"),
);
const MyPaymentsLazy = lazy(() => import("./pages/Reports/MyPayments"));
const MealOptionManagement = lazy(() => import("./pages/MealOption"));
const HolidayEventManagement = lazy(() => import("./pages/HolidayEvent"));
const SsoCallback = lazy(() => import("./pages/AuthPages/SsoCallback"));

const PageLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="inline-block animate-spin">
      <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-blue-500" />
    </div>
  </div>
);

const withSuspense = (element: React.ReactElement) => (
  <Suspense fallback={<PageLoading />}>{element}</Suspense>
);

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/auth/sso/callback" element={withSuspense(<SsoCallback />)} />
          {/* Dashboard Layout - Protected */}
          <Route element={<ProtectedRoute element={<AppLayout />} />}>
            {/* Trang chủ: mọi role đều xem được, nhưng nội dung khác nhau -
                cán bộ/quản lý (SELF_MEAL_ROLES) vào thẳng trang đăng ký/cắt
                suất ăn, admin/bếp vẫn thấy Dashboard (xem HomeRouter). */}
            <Route index path="/" element={<HomeRouter />} />

            {/* Cán bộ/quản lý - KHÔNG bao gồm admin: admin là tài khoản quản
                lý hệ thống thuần túy, không tự đăng ký/cắt suất ăn cho
                chính mình (đăng ký/cắt suất HỘ người khác thực hiện ở
                trang "Lịch ăn" bên dưới, vẫn STAFF vì admin cần quản lý). */}
            <Route
              path="meal-registration"
              element={
                <ProtectedRoute
                  allowedRoles={SELF_MEAL_ROLES}
                  element={withSuspense(<MealRegistration />)}
                />
              }
            />
            <Route
              path="meal-schedule"
              element={
                <ProtectedRoute
                  allowedRoles={STAFF}
                  element={withSuspense(<MealSchedule />)}
                />
              }
            />

            {/* Quản lý trở lên */}
            <Route
              path="/user-management"
              element={
                <ProtectedRoute
                  allowedRoles={MANAGER_UP}
                  element={withSuspense(<UserManagement />)}
                />
              }
            />
            <Route
              path="/notification-management"
              element={
                <ProtectedRoute
                  allowedRoles={MANAGER_UP}
                  element={withSuspense(<NotificationManagementLazy />)}
                />
              }
            />
            {/* Báo cáo/thống kê toàn cơ quan (xuất Excel): admin + manager */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute
                  allowedRoles={MANAGER_UP}
                  element={withSuspense(<MealPaymentReportsLazy />)}
                />
              }
            />
            {/* Thống kê + thanh toán CÁ NHÂN của cán bộ/quản lý */}
            <Route
              path="/my-statistics"
              element={
                <ProtectedRoute
                  allowedRoles={SELF_MEAL_ROLES}
                  element={withSuspense(<MyMealStatisticsLazy />)}
                />
              }
            />
            <Route
              path="/my-payments"
              element={
                <ProtectedRoute
                  allowedRoles={SELF_MEAL_ROLES}
                  element={withSuspense(<MyPaymentsLazy />)}
                />
              }
            />
            <Route
              path="/meal-option-management"
              element={
                <ProtectedRoute
                  allowedRoles={MANAGER_UP}
                  element={withSuspense(<MealOptionManagement />)}
                />
              }
            />
            <Route
              path="/holiday-event-management"
              element={
                <ProtectedRoute
                  allowedRoles={MANAGER_UP}
                  element={withSuspense(<HolidayEventManagement />)}
                />
              }
            />

            {/* Chỉ admin */}
            <Route
              path="/setting-management"
              element={
                <ProtectedRoute
                  allowedRoles={ADMIN_ONLY}
                  element={withSuspense(<SettingManagement />)}
                />
              }
            />
            <Route
              path="/permission-management"
              element={
                <ProtectedRoute
                  allowedRoles={ADMIN_ONLY}
                  element={withSuspense(<PermissionManagementLazy />)}
                />
              }
            />
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute
                  allowedRoles={ADMIN_ONLY}
                  element={withSuspense(<AuditLogManagementLazy />)}
                />
              }
            />

            <Route path="/blank" element={<Blank />} />
          </Route>

          {/* Auth Layout */}
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
          />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
