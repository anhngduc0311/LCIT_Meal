/**
 * Notification Service
 * Quản lý thông báo, đếm số thông báo chưa đọc, đánh dấu đã xem, soạn và phát thông báo
 */

import { apiClient, extractDataList } from './apiClient';
import { mockStore } from './mockStore';
import {
  NotificationItem,
  UnseenCountResponse,
  SendNotificationRequest,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  PaginatedData,
} from '../types';

export const notificationService = {
  /**
   * Lấy danh sách thông báo của tôi: GET /api/notifications/me
   */
  async getMyNotifications(useMock = false): Promise<NotificationItem[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getMyNotifications();
    }
    const res = await apiClient<NotificationItem[] | PaginatedData<NotificationItem>>('/notifications/me');
    return extractDataList<NotificationItem>(res);
  },

  /**
   * Lấy toàn bộ danh sách thông báo hệ thống (Admin/Manager): GET /api/notifications
   */
  async getAllNotifications(useMock = false): Promise<NotificationItem[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      return mockStore.getAllNotifications();
    }
    const res = await apiClient<NotificationItem[] | PaginatedData<NotificationItem>>('/notifications');
    return extractDataList<NotificationItem>(res);
  },

  /**
   * Lọc thông báo (Admin/Manager): GET /api/notifications/filter
   */
  async filterNotifications(query?: string, status?: string, useMock = false): Promise<NotificationItem[]> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 200));
      let list = mockStore.getAllNotifications();
      if (query) {
        const q = query.toLowerCase();
        list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      }
      if (status) {
        list = list.filter((n) => n.status === status);
      }
      return list;
    }

    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (status) params.append('status', status);

    const res = await apiClient<NotificationItem[] | PaginatedData<NotificationItem>>(
      `/notifications/filter?${params.toString()}`
    );
    return extractDataList<NotificationItem>(res);
  },

  /**
   * Soạn & phát thông báo tới danh sách userIds hoặc Broadcast toàn bộ (Admin/Manager): POST /api/notifications/send
   */
  async sendNotification(data: SendNotificationRequest, useMock = false): Promise<NotificationItem> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 400));
      return mockStore.sendNotification(data);
    }
    const { image, ...payload } = data;
    if (image) {
      const body = new FormData();
      body.append('payload', JSON.stringify(payload));
      const file = image.file ?? ({ uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
      body.append('image', file);
      return apiClient<NotificationItem>('/notifications/send', { method: 'POST', body });
    }
    return await apiClient<NotificationItem>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Tạo thông báo: POST /api/notifications (Admin/Manager)
   */
  async createNotification(data: CreateNotificationRequest, useMock = false): Promise<NotificationItem> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      return mockStore.sendNotification(data);
    }
    return await apiClient<NotificationItem>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Sửa thông báo: PUT /api/notifications/:id (Admin/Manager)
   */
  async updateNotification(
    id: number,
    data: UpdateNotificationRequest,
    useMock = false
  ): Promise<NotificationItem> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      const updated = mockStore.updateNotification(id, data);
      if (!updated) throw new Error('Cập nhật thông báo thất bại');
      return updated;
    }
    return await apiClient<NotificationItem>(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Xóa thông báo: DELETE /api/notifications/:id (Admin/Manager)
   */
  async deleteNotification(id: number, useMock = false): Promise<void> {
    if (useMock) {
      await new Promise((res) => setTimeout(res, 300));
      mockStore.deleteNotification(id);
      return;
    }
    await apiClient(`/notifications/${id}`, { method: 'DELETE' });
  },

  /**
   * Lấy số lượng thông báo chưa đọc: GET /api/notifications/me/unseen-count
   */
  async getUnseenCount(useMock = false): Promise<number> {
    if (useMock) {
      return mockStore.getUnseenNotificationCount();
    }
    try {
      const res = await apiClient<UnseenCountResponse>('/notifications/me/unseen-count');
      if (res && typeof res.total === 'number') {
        return res.total;
      }
      if (res && typeof res.count === 'number') {
        return res.count;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * Đánh dấu 1 thông báo đã đọc: PATCH /api/notifications/:id/seen
   */
  async markAsSeen(notificationId: number, useMock = false): Promise<void> {
    if (useMock) {
      mockStore.markNotificationAsSeen(notificationId);
      return;
    }
    try {
      await apiClient(`/notifications/${notificationId}/seen`, { method: 'PATCH' });
    } catch {
      // Bỏ qua lỗi mạng nhỏ khi mark seen
    }
  },

  /**
   * Đánh dấu tất cả thông báo đã đọc: PATCH /api/notifications/me/seen-all
   */
  async markAllAsSeen(useMock = false): Promise<void> {
    if (useMock) {
      mockStore.markAllNotificationsAsSeen();
      return;
    }
    await apiClient('/notifications/me/seen-all', { method: 'PATCH' });
  },
};
