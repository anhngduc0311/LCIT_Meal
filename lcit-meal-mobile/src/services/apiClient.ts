/**
 * API Client
 * Lớp giao tiếp HTTP chuẩn với backend `/api`
 * Hỗ trợ tự động đính kèm Bearer Token, bóc tách Response Envelope { success, payload, error },
 * xử lý timeout (AbortController), lỗi mạng và bắt sự kiện 401 (Hết hạn phiên).
 */

import { env } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import { storage } from '../utils/storage';
import { ApiResponse, PaginatedData } from '../types';

export class ApiError extends Error {
  code: number;
  payload?: unknown;

  constructor(code: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.payload = payload;
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

/**
 * Đăng ký callback khi gặp lỗi 401 Unauthenticated từ máy chủ
 */
export function registerUnauthorizedCallback(callback: (() => void) | null) {
  onUnauthorizedCallback = callback;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function getApiBaseUrl(): Promise<string> {
  const overriddenUrl = await storage.getItem(STORAGE_KEYS.API_URL_OVERRIDE);
  const rawBaseUrl = (overriddenUrl || env.apiBaseUrl).trim().replace(/\/+$/, '');
  return rawBaseUrl.endsWith('/api') ? rawBaseUrl : rawBaseUrl + '/api';
}

/**
 * Hàm gọi API backend bọc chuẩn ApiResponse
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = env.requestTimeoutMs, skipAuth = false, ...customConfig } = options;

  // Lấy API URL (hỗ trợ cấu hình tùy biến khi chạy máy thật)
  const baseUrl = await getApiBaseUrl();

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(customConfig.headers as Record<string, string>),
  };

  // FormData cần để engine tự sinh header Content-Type kèm boundary
  if (customConfig.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const requestToken = skipAuth ? null : await storage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  if (!skipAuth) {
    if (requestToken) {
      headers['Authorization'] = `Bearer ${requestToken}`;
    }
  }

  // Setup timeout qua AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      ...customConfig,
      headers,
      signal: controller.signal,
    });

    // Xử lý 401 Unauthorized
    if (response.status === 401 && !skipAuth) {
      // A delayed response from an old session must never log out a new one.
      const currentToken = await storage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (requestToken && currentToken === requestToken) onUnauthorizedCallback?.();
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (response.status === 204) return null as unknown as T;

    let json: ApiResponse<T>;
    try {
      json = (await response.json()) as ApiResponse<T>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      if (!response.ok) {
        throw new ApiError(response.status, `Lỗi máy chủ HTTP ${response.status}`);
      }
      throw new ApiError(502, 'Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
    }

    if (!json || typeof json !== 'object' || typeof json.success !== 'boolean') {
      throw new ApiError(502, 'Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
    }

    if (!response.ok || !json.success) {
      const errorCode = json.error?.code || response.status;
      const errorMessage =
        json.error?.message ||
        `Yêu cầu thất bại với mã lỗi HTTP ${response.status}`;
      throw new ApiError(errorCode, errorMessage, json.payload);
    }

    return json.payload as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'Hết thời gian chờ kết nối máy chủ (Timeout). Vui lòng thử lại.');
    }

    // Lỗi kết nối mạng (mất mạng, URL sai...)
    throw new ApiError(
      0,
      `Không thể kết nối đến máy chủ (${baseUrl}). Vui lòng kiểm tra kết nối mạng (WiFi/4G) hoặc cấu hình API URL.`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Trợ giúp trích xuất mảng dữ liệu dù backend trả về trực tiếp mảng hay bọc trong { data: T[], pagination: ... }
 */
export function extractDataList<T>(payload: T[] | PaginatedData<T> | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && 'data' in payload && Array.isArray((payload as PaginatedData<T>).data)) {
    return (payload as PaginatedData<T>).data;
  }
  return [];
}
