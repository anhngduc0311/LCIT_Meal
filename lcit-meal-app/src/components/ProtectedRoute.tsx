import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { canUsePersonalMeals, PERSONAL_MEAL_PATHS } from "@/constants/roles";

interface ProtectedRouteProps {
  element: React.ReactElement;
  // Nếu không truyền: chỉ cần đăng nhập là vào được (giữ hành vi cũ).
  // Nếu truyền: user phải có ít nhất 1 role code nằm trong danh sách này.
  allowedRoles?: string[];
}

export function ProtectedRoute({ element, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full" />
          </div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const roleCodes = user?.roles.map(role => role.code) ?? [];
  if (PERSONAL_MEAL_PATHS.includes(pathname.replace(/\/+$/, "")) && !canUsePersonalMeals(user?.username, roleCodes)) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const roleCodes = user?.roles.map((r) => r.code) ?? [];
    const isAllowed = allowedRoles.some((role) => roleCodes.includes(role));
    if (!isAllowed) {
      return <Navigate to="/" replace />;
    }
  }

  return element;
}
