// File: src/components/auth/SignInForm.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import MdiIcon from "../common/MdiIcon";
import { mdiEye, mdiEyeClosed } from "@mdi/js";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth, SESSION_EXPIRED_MESSAGE_KEY } from "@/context/AuthContext";
import { authService } from "@/api/services/AuthService";

export default function SignInForm() {
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuth();

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Loading & Error State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Khôi phục username đã lưu trước đó (nếu có)
   * Chỉ chạy một lần khi component mount
   */
  useEffect(() => {
    const savedUsername = localStorage.getItem("remembered_username");
    if (savedUsername) {
      setUsername(savedUsername);
      setIsChecked(true);
    }
  }, []);

  /**
   * Hiển thị thông báo "phiên đăng nhập hết hạn" (nếu có) sau khi bị hệ thống
   * tự động đăng xuất do bearer token bị hủy/hết hạn.
   */
  useEffect(() => {
    try {
      const message = sessionStorage.getItem(SESSION_EXPIRED_MESSAGE_KEY);
      if (message) {
        setError(message);
        sessionStorage.removeItem(SESSION_EXPIRED_MESSAGE_KEY);
      }
    } catch (err) {
      console.error("Không thể đọc thông báo hết phiên:", err);
    }
  }, []);

  /**
   * Xử lý submit form đăng nhập
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate form
      if (!username.trim() || !password.trim()) {
        setError("Vui lòng nhập tên đăng nhập và mật khẩu");
        setIsLoading(false);
        return;
      }

      // 1. Gọi API login
      const response = await authService.login({
        username: username.trim(),
        password,
      });

      // 2. Kiểm tra response
      if (!response.success) {
        const errorMessage = response.error || "Đăng nhập thất bại";
        setError(errorMessage);
        return;
      }

      // 3. Lấy dữ liệu từ response
      const { user, accessToken } = response.payload;

      if (!user || !accessToken) {
        setError("Dữ liệu response không hợp lệ");
        return;
      }

      // 4. Cập nhật Auth context (sẽ tự động lưu vào localStorage)
      setUser(user);
      setAccessToken(accessToken);

      // 5. Lưu "Remember me" nếu cần
      if (isChecked) {
        localStorage.setItem("remembered_username", username);
      } else {
        localStorage.removeItem("remembered_username");
      }

      // 6. Điều hướng sang trang chủ
      navigate("/", { replace: true });
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        err?.error ||
        "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen px-4 py-8 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="p-6 bg-white border border-gray-200 shadow-xl rounded-2xl dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Đăng nhập
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nhập tên đăng nhập và mật khẩu để truy cập hệ thống
            </p>
          </div>

          <div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-6">
                {/* Error Message */}
                {error && (
                  <div
                    className="p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/50"
                    role="alert"
                  >
                    <strong>Lỗi:</strong> {error}
                  </div>
                )}

                {/* Username Input */}
                <div>
                  <Label htmlFor="username">
                    Tên đăng nhập <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="username"
                    className="mt-1"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <Label htmlFor="password">
                    Mật khẩu <span className="text-error-500">*</span>
                  </Label>

                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="current-password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2 hover:opacity-75 disabled:opacity-50"
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                      }
                    >
                      {showPassword ? (
                        <MdiIcon
                          path={mdiEye}
                          className="fill-gray-500 dark:fill-gray-400 size-5"
                        />
                      ) : (
                        <MdiIcon
                          path={mdiEyeClosed}
                          className="fill-gray-500 dark:fill-gray-400 size-5"
                        />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me Checkbox */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="remember"
                      checked={isChecked}
                      onChange={setIsChecked}
                      disabled={isLoading}
                    />

                    <label
                      htmlFor="remember"
                      className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400 cursor-pointer"
                    >
                      Nhớ thông tin đăng nhập
                    </label>
                  </div>
                </div>

                {/* Sign in Button */}
                <div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={isLoading}
                    type="submit"
                    aria-busy={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block animate-spin">
                          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        </span>
                        Đang đăng nhập...
                      </span>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Divider */}
            <div className="relative py-3 sm:py-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800" />
              </div>

              <div className="relative flex justify-center text-sm">
                <span className="px-4 py-2 text-gray-400 bg-white dark:bg-gray-900">
                  Hoặc
                </span>
              </div>
            </div>

            {/* SSO Button (Optional) */}
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-3 px-7 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Đăng nhập với SSO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
