/**
 * Environment Configuration
 * Quản lý biến môi trường và thiết lập chế độ Dữ liệu Mẫu (Mock) / Kết nối API thật
 */

// URL mặc định máy chủ backend
const DEFAULT_API_URL = 'https://com365.lcit.vn:4002/api';

// URL mặc định theo môi trường chạy
const getDefaultApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const raw = process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/+$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  return DEFAULT_API_URL;
};

export const env = {
  appName: 'LCIT Meal',
  appVersion: '1.0.0',
  apiBaseUrl: getDefaultApiUrl(),
  // Mặc định kết nối API thật, tắt chế độ mock
  defaultUseMock: process.env.EXPO_PUBLIC_USE_MOCK === 'true',
  // Timeout cho HTTP request (ms)
  requestTimeoutMs: 15000,
  // Cutoff time mặc định nếu chưa lấy được từ server
  defaultCutoffTime: '08:00',
  // Giá suất ăn mặc định (VNĐ)
  defaultMealPrice: 30000,
};
