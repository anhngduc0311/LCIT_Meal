// File: src/context/AuthContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { User } from "@/api/types/auth";
import { AUTH_UNAUTHORIZED_EVENT } from "@/api/client";

// Key sessionStorage dùng để hiển thị 1 lần thông báo "phiên đăng nhập hết hạn"
// trên trang đăng nhập sau khi bị tự động đăng xuất.
export const SESSION_EXPIRED_MESSAGE_KEY = "session_expired_message";

interface AuthContextType {
  // State
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Methods
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * Quản lý trạng thái xác thực của ứng dụng
 * Tự động khôi phục dữ liệu từ localStorage
 * 
 * Sử dụng:
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Khôi phục dữ liệu từ localStorage khi ứng dụng khởi động
   * Chỉ chạy một lần khi component mount
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("access_token");

    if (storedUser && storedToken) {
      try {
        setUserState(JSON.parse(storedUser));
        setAccessTokenState(storedToken);
      } catch (error) {
        console.error("Lỗi khi khôi phục dữ liệu từ localStorage:", error);
        // Xóa dữ liệu bị hỏng
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
      }
    }
    setIsLoading(false);
  }, []);

  /**
   * Wrapper cho setUser
   * Lưu dữ liệu vào localStorage khi user thay đổi
   */
  const handleSetUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      try {
        localStorage.setItem("user", JSON.stringify(newUser));
      } catch (error) {
        console.error("Lỗi khi lưu user vào localStorage:", error);
      }
    } else {
      localStorage.removeItem("user");
    }
  };

  /**
   * Wrapper cho setAccessToken
   * Lưu token vào localStorage khi token thay đổi
   */
  const handleSetAccessToken = (token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      try {
        localStorage.setItem("access_token", token);
      } catch (error) {
        console.error("Lỗi khi lưu token vào localStorage:", error);
      }
    } else {
      localStorage.removeItem("access_token");
    }
  };

  /**
   * Xóa toàn bộ dữ liệu xác thực. Gọi khi người dùng chủ động đăng xuất
   * hoặc khi bị hệ thống tự động đăng xuất do token bị thu hồi/hết hạn.
   */
  const handleLogout = () => {
    setUserState(null);
    setAccessTokenState(null);
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
  };

  /**
   * Lắng nghe sự kiện "auth:unauthorized" được ApiClient phát ra khi một
   * request bị server từ chối với 401 (bearer token đã bị thu hồi/hết hạn).
   * Khi đó tự động đăng xuất người dùng khỏi ứng dụng.
   *
   * Thao tác đăng xuất được inline trực tiếp trong effect (thay vì gọi qua
   * handleLogout) vì handleLogout chỉ dùng các setState setter ổn định nên
   * không cần đưa vào dependency array hay dùng ref để "neo" giá trị mới nhất.
   */
  useEffect(() => {
    const handleUnauthorized = () => {
      // Không có gì để đăng xuất nếu người dùng vốn chưa đăng nhập.
      if (!localStorage.getItem("access_token")) return;

      setUserState(null);
      setAccessTokenState(null);
      localStorage.removeItem("user");
      localStorage.removeItem("access_token");

      try {
        sessionStorage.setItem(
          SESSION_EXPIRED_MESSAGE_KEY,
          "Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi. Vui lòng đăng nhập lại.",
        );
      } catch (error) {
        console.error("Không thể lưu thông báo hết phiên:", error);
      }
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    setUser: handleSetUser,
    setAccessToken: handleSetAccessToken,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 * Sử dụng để truy cập Auth context trong các component
 * 
 * Ví dụ sử dụng:
 * const { user, accessToken, isAuthenticated, logout } = useAuth();
 * 
 * @returns AuthContextType
 * @throws Error nếu sử dụng ngoài AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      "useAuth phải được sử dụng bên trong <AuthProvider>. " +
        "Hãy đảm bảo rằng component của bạn được bao bọc bởi AuthProvider."
    );
  }
  return context;
}
