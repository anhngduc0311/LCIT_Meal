import { Suspense, lazy } from "react";
import Home from "./Dashboard/Home";
import { useAuth } from "@/context/AuthContext";
import { homeView } from "@/constants/roles";

const MealRegistration = lazy(
  () => import("./MealRegistration/MealRegistration"),
);

const PageLoading = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="inline-block animate-spin">
      <div className="h-8 w-8 rounded-full border-4 border-gray-300 border-t-blue-500" />
    </div>
  </div>
);

// Trang chủ ("/") không cố định 1 trang cho mọi role:
//  - Cán bộ/quản lý (những người thực sự ăn suất ăn) đăng nhập vào thẳng
//    trang "Đăng ký / Cắt suất ăn" - đây là việc họ cần làm hàng ngày.
//  - Tài khoản dùng chung quanly, admin và bếp vào Dashboard điều hành.
export default function HomeRouter() {
  const { user } = useAuth();
  const roleCodes = user?.roles.map((r) => r.code) ?? [];

  if (homeView(user?.username, roleCodes) === "personal") {
    return (
      <Suspense fallback={<PageLoading />}>
        <MealRegistration />
      </Suspense>
    );
  }

  return <Home />;
}
