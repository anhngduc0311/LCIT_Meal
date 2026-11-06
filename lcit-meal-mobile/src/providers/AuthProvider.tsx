/**
 * Auth Provider
 * Quản lý phiên đăng nhập, vai trò người dùng (Role),
 * Chuyển đổi nhanh tài khoản thử nghiệm (Demo) và toggle chế độ Mock.
 * TUÂN THỦ T21: Tự động đưa về đăng nhập khi 401 và xóa toàn bộ cache cá nhân.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { User, UserRole, LoginRequest, extractUserRole } from '../types';
import { authService } from '../services/authService';
import { mockStore } from '../services/mockStore';
import { registerUnauthorizedCallback } from '../services/apiClient';
import { queryClient } from './QueryProvider';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../config/constants';
import { env } from '../config/env';
import { loginWithSso, PreparedSso } from '../services/ssoService';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  useMockData: boolean;
  isMockMode: boolean;
  login: (credentials: LoginRequest) => Promise<{ user: User; token: string }>;
  loginSso: (prepared: PreparedSso) => Promise<void>;
  ssoPending: boolean;
  ssoError: string | null;
  logout: () => Promise<void>;
  switchMockUser: (userId: number) => Promise<void>;
  setUseMockData: (enabled: boolean) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ssoPending, setSsoPending] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [useMockData, setUseMockDataState] = useState<boolean>(env.defaultUseMock);

  // Xử lý khi nhận 401 từ server
  const handleUnauthorized = useCallback(async () => {
    await storage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await storage.removeItem(STORAGE_KEYS.USER_DATA);
    queryClient.clear(); // Xóa sạch cache truy vấn
    setUser(null);
    setToken(null);
    router.replace('/(auth)/login');
  }, []);

  // Đăng ký callback 401 với apiClient
  useEffect(() => {
    registerUnauthorizedCallback(handleUnauthorized);
    return () => {
      registerUnauthorizedCallback(null);
    };
  }, [handleUnauthorized]);

  // Khởi động và khôi phục phiên
  useEffect(() => {
    async function initAuth() {
      try {
        // Đọc cài đặt mock
        const savedMockSetting = await storage.getItem(STORAGE_KEYS.USE_MOCK_DATA);
        const isMock = savedMockSetting !== null ? savedMockSetting === 'true' : env.defaultUseMock;
        setUseMockDataState(isMock);

        // Khôi phục session đã lưu
        const session = await authService.getStoredSession();
        if (session.user && session.token) {
          setUser(session.user);
          setToken(session.token);
          if (isMock) {
            mockStore.setCurrentUser(session.user.id);
          }
        } else {
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      // The login screen owns its pending/error state. Keep navigation mounted.
      setSsoError(null);
      const res = await authService.login(credentials, useMockData);
      queryClient.clear();
      setUser(res.user);
      setToken(res.token);
      return res;
    },
    [useMockData]
  );

  const loginSso = useCallback(async (prepared: PreparedSso) => {
    if (useMockData) throw new Error('Tắt chế độ dữ liệu mẫu trước khi đăng nhập SSO.');
    setSsoPending(true);
    setSsoError(null);
    try {
      const result = await loginWithSso(prepared);
      if (result) {
        queryClient.clear();
        setUser(result.user);
        setToken(result.token);
      }
    } catch (error) {
      setSsoError(error instanceof Error ? error.message : 'Không hoàn tất được đăng nhập SSO.');
    } finally {
      setSsoPending(false);
      router.replace('/(auth)/login');
    }
  }, [useMockData]);

  const logout = useCallback(async () => {
    try {
      await authService.logout(useMockData);
      queryClient.clear(); // Xóa toàn bộ cache cá nhân để không bị lộ cho người sau
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error('Error during logout:', err);
    }
  }, [useMockData]);

  const switchMockUser = useCallback(
    async (userId: number) => {
      queryClient.clear();
      mockStore.setCurrentUser(userId);
      const newUser = mockStore.getCurrentUser();
      const mockToken = `mock_token_${newUser.id}`;
      const normalized: User = {
        ...newUser,
        role: extractUserRole(newUser),
      };
      setUser(normalized);
      setToken(mockToken);
      await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, mockToken);
      await storage.setObject(STORAGE_KEYS.USER_DATA, normalized);
    },
    []
  );

  const setUseMockData = useCallback(async (enabled: boolean) => {
    setUseMockDataState(enabled);
    await storage.setItem(STORAGE_KEYS.USE_MOCK_DATA, enabled ? 'true' : 'false');
    queryClient.clear(); // Xóa cache để tải lại theo nguồn dữ liệu mới
  }, []);

  const updateUserProfile = useCallback((data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      updated.role = extractUserRole(updated);
      return updated;
    });
  }, []);

  const role: UserRole | null = useMemo(() => {
    if (!user) return null;
    return extractUserRole(user);
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      role,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      useMockData,
      isMockMode: useMockData,
      login,
      loginSso,
      ssoPending,
      ssoError,
      logout,
      switchMockUser,
      setUseMockData,
      updateUserProfile,
    }),
    [user, role, token, isLoading, useMockData, login, loginSso, ssoPending, ssoError, logout, switchMockUser, setUseMockData, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
