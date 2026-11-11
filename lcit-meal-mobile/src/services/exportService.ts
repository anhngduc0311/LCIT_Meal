/**
 * Export Service
 * Tải file Excel báo cáo suất ăn và thanh toán có xác thực Bearer token,
 * hỗ trợ lưu file trên thiết bị di động (Android / iOS) và mở hộp thoại chia sẻ / xem file qua expo-sharing.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { env } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import { storage } from '../utils/storage';
import { MealRegistrationFilterParams, PaymentFilterParams } from '../types';
import type { buildMonthlyCollections } from '../utils/monthlyCollections';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExportResult {
  success: boolean;
  filePath?: string;
  message?: string;
}

export const exportService = {
  async exportMonthlyCollections(month: string, throughDate: string, summary: ReturnType<typeof buildMonthlyCollections>): Promise<ExportResult> {
    const rows = summary.rows.map(({ name, username, staff, staffAmount, guests, guestAmount,
      adjustmentAmount, paidAmount, remainingAmount, creditAmount }) => ({
      name, username, staff, staffAmount, guests, guestAmount, adjustmentAmount, paidAmount, remainingAmount, creditAmount,
    }));
    const guestCount = summary.standalone.reduce((sum, guest) => sum + guest.count, 0);
    const body = JSON.stringify({ month, throughDate, rows, guestCount, guestAmount: summary.standaloneGuestAmount });
    return this.downloadAndShareFile('/payments/monthly-board/export', `thu-tien-an_co-so-1_${month}.xlsx`, body);
  },

  /**
   * Tải và mở báo cáo Excel danh sách đăng ký suất ăn: GET /api/meal-registrations/export
   */
  async exportMealRegistrations(
    params: MealRegistrationFilterParams = {},
    useMock = false
  ): Promise<ExportResult> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 1000));
      return {
        success: true,
        message: 'Xuất file thành công (Chế độ mẫu demo).',
      };
    }

    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', String(params.userId));
    if (params.mealId) queryParams.append('mealId', String(params.mealId));
    if (params.status) queryParams.append('status', params.status);
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);

    const endpoint = `/meal-registrations/export?${queryParams.toString()}`;
    const filename = `danh-sach-suat-an_${params.from || 'all'}_${params.to || 'all'}.xlsx`;

    return await this.downloadAndShareFile(endpoint, filename);
  },

  /**
   * Tải và mở báo cáo Excel danh sách thanh toán: GET /api/payments/export
   */
  async exportPayments(
    params: PaymentFilterParams = {},
    useMock = false
  ): Promise<ExportResult> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 1000));
      return {
        success: true,
        message: 'Xuất file thành công (Chế độ mẫu demo).',
      };
    }

    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.append('userId', String(params.userId));
    if (params.status) queryParams.append('status', params.status);
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);

    const endpoint = `/payments/export?${queryParams.toString()}`;
    const filename = `bao-cao-thanh-toan_${params.from || 'all'}_${params.to || 'all'}.xlsx`;

    return await this.downloadAndShareFile(endpoint, filename);
  },

  /**
   * Tải file nhị phân qua fetch kèm header Authorization và lưu/chia sẻ
   */
  async downloadAndShareFile(endpoint: string, filename: string, body?: string): Promise<ExportResult> {
    const overriddenUrl = await storage.getItem(STORAGE_KEYS.API_URL_OVERRIDE);
    const rawBaseUrl = (overriddenUrl || env.apiBaseUrl).trim().replace(/\/+$/, '');
    const baseUrl = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${baseUrl}${cleanEndpoint}`;

    const token = await storage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const headers: Record<string, string> = {
      Accept: XLSX_MIME,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let filePath: string;
      if (Platform.OS === 'web' || body !== undefined) {
        const res = await fetch(fullUrl, body === undefined
          ? { headers }
          : { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body });
        if (!res.ok) {
          throw new Error(`Lỗi tải file (HTTP ${res.status})`);
        }
        if (body !== undefined && !res.headers.get('Content-Type')?.includes(XLSX_MIME)) {
          throw new Error('Máy chủ không trả về file Excel hợp lệ.');
        }
        if (Platform.OS === 'web') {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          return { success: true, message: `Đã tải xuống file ${filename}` };
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        const file = new File(Paths.document, filename);
        file.create({ overwrite: true });
        file.write(bytes);
        filePath = file.uri;
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        const downloaded = await FileSystem.downloadAsync(fullUrl, fileUri, { headers });
        if (downloaded.status < 200 || downloaded.status >= 300) {
          throw new Error(`Lỗi tải file (HTTP ${downloaded.status})`);
        }
        filePath = downloaded.uri;
      }

      // Mở chia sẻ file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: XLSX_MIME,
          dialogTitle: `Xuất file ${filename}`,
          UTI: 'com.microsoft.excel.xlsx',
        });
      }

      return {
        success: true,
        filePath,
        message: `Đã lưu file thành công vào thiết bị: ${filename}`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        message: err.message || 'Không thể tải file báo cáo. Vui lòng thử lại.',
      };
    }
  },
};
