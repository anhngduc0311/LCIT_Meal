// File: src/api/services/AuthService.ts

import apiClient from "../client";
import type { LoginRequest, LoginResponse } from "../types/auth";

export class AuthService {
  constructor(private readonly client = apiClient) {}

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await this.client.post<LoginResponse>(
        "/auth/login",
        credentials,
        { skipAuthHandling: true },
      );
      if (response.payload?.accessToken) {
        localStorage.setItem("access_token", response.payload.accessToken);
      }
      return response;
    } catch (error) {
      // Xử lý lỗi nếu cần
      throw new Error("Đăng nhập thất bại", { cause: error });
    }
  }

  /**
   * Đăng xuất
   *
   * Ví dụ sử dụng:
   * await authService.logout();
   */
  async logout(): Promise<void> {
    try {
      // Token có thể đã hết hạn/bị hủy trước khi người dùng bấm đăng xuất;
      // bỏ qua xử lý auto-logout ở đây để tránh gọi handler 2 lần.
      await this.client.post("/auth/logout", undefined, {
        skipAuthHandling: true,
      });
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    }
  }

  /**
   * Kiểm tra xác thực token (tùy chọn)
   * @param token - JWT token cần kiểm tra
   * @returns Boolean cho biết token có hợp lệ không
   *
   * Ví dụ sử dụng:
   * const isValid = await authService.verifyToken(token);
   */
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await this.client.post<{ valid: boolean }>(
        "/auth/verify",
        { token },
      );
      return response.valid;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  /**
   * Làm mới token (tùy chọn)
   * @returns Response chứa token mới
   *
   * Ví dụ sử dụng:
   * const newToken = await authService.refreshToken();
   */
  async refreshToken(): Promise<{ accessToken: string }> {
    try {
      const response = await this.client.post<{ accessToken: string }>(
        "/auth/refresh",
      );
      return response;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export const authService = new AuthService();
