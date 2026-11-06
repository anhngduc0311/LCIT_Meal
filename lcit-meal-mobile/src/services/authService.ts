/**
 * Auth Service
 * Xử lý Đăng nhập, Đăng xuất, Lưu phiên và Cập nhật hồ sơ
 * TUÂN THỦ T21: Không gọi GET /auth/me hay refresh token không tồn tại ở backend.
 */

import { apiClient } from './apiClient';
import { mockStore } from './mockStore';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../config/constants';
import {
  User,
  LoginRequest,
  LoginResponsePayload,
  UpdateProfileRequest,
  extractUserRole,
} from '../types';

export const authService = {
  /**
   * Đăng nhập
   */
  async login(credentials: LoginRequest, useMock = false): Promise<{ user: User; token: string }> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const users = mockStore.getAllUsers();
      const matched = users.find(
        (u) =>
          u.username.toLowerCase() === credentials.username.toLowerCase()
      );

      if (!matched) {
        throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác.');
      }

      const mockToken = `mock_token_${matched.id}_${Date.now()}`;
      const normalizedUser: User = {
        ...matched,
        role: extractUserRole(matched),
      };

      await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, mockToken);
      await storage.setObject(STORAGE_KEYS.USER_DATA, normalizedUser);
      mockStore.setCurrentUser(matched.id);

      return { user: normalizedUser, token: mockToken };
    }

    // Gọi API thật: POST /api/auth/login
    const payload = await apiClient<LoginResponsePayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username.trim(),
        password: credentials.password,
      }),
      skipAuth: true,
    });

    const token = payload.accessToken || payload.token || '';
    const rawUser = payload.user;

    const normalizedUser: User = {
      ...rawUser,
      role: extractUserRole(rawUser),
    };

    await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    await storage.setObject(STORAGE_KEYS.USER_DATA, normalizedUser);

    return { user: normalizedUser, token };
  },

  /**
   * Đăng xuất
   */
  async logout(useMock = false): Promise<void> {
    if (!useMock) {
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch {
        // Bỏ qua lỗi kết nối khi logout
      }
    }
    await storage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await storage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  /**
   * Khôi phục phiên đã lưu
   */
  async getStoredSession(): Promise<{ user: User | null; token: string | null }> {
    const token = await storage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const user = await storage.getObject<User>(STORAGE_KEYS.USER_DATA);
    if (user) {
      user.role = extractUserRole(user);
    }
    return { user, token };
  },

  /**
   * Cập nhật thông tin cá nhân: PATCH /api/users/me
   */
  async updateProfile(data: UpdateProfileRequest, useMock = false): Promise<User> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const currentUser = mockStore.getCurrentUser();
      const updated: User = {
        ...currentUser,
        fullName: data.fullName || currentUser.fullName,
        email: data.email !== undefined ? data.email : currentUser.email,
        phone: data.phone !== undefined ? data.phone : currentUser.phone,
      };
      await storage.setObject(STORAGE_KEYS.USER_DATA, updated);
      return updated;
    }

    // Chuẩn bị payload cho PATCH /api/users/me
    const body: Record<string, unknown> = {};
    if (data.fullName) body.fullName = data.fullName.trim();
    if (data.phone !== undefined) body.phone = data.phone.trim();
    if (data.password) body.password = data.password;

    const updatedUser = await apiClient<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    const normalizedUser: User = {
      ...updatedUser,
      role: extractUserRole(updatedUser),
    };

    await storage.setObject(STORAGE_KEYS.USER_DATA, normalizedUser);
    return normalizedUser;
  },
};
