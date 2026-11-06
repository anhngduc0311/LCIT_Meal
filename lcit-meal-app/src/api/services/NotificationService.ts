import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// Khớp với models/Notification.js ở backend.
export type NotificationStatus = "active" | "inactive" | string;

export type SystemNotification = {
  id: number;
  title: string;
  content: string;
  url: string | null;
  status: NotificationStatus;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
  isSeen?: boolean;
  seenAt?: string | null;
};

export type NotificationListParams = {
  query?: string;
  status?: string;
};

export type CreateNotificationRequest = {
  title: string;
  content: string;
  url?: string;
  status?: string;
};

// Gửi thông báo tới người nhận cụ thể (userIds), hoặc broadcast cho tất cả
// người dùng đang active nếu bỏ trống userIds.
export type SendNotificationRequest = CreateNotificationRequest & {
  userIds?: number[];
};

export class NotificationService {
  constructor(private readonly client = apiClient) {}

  async list(params?: NotificationListParams): Promise<SystemNotification[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    const query = searchParams.toString();
    const response = await this.client.get<ApiResponse<SystemNotification[]>>(
      query ? `/notifications/filter?${query}` : "/notifications",
    );
    return response.payload;
  }

  async create(
    payload: CreateNotificationRequest,
  ): Promise<SystemNotification> {
    const response = await this.client.post<ApiResponse<SystemNotification>>(
      "/notifications",
      payload,
    );
    return response.payload;
  }

  async send(payload: SendNotificationRequest): Promise<SystemNotification> {
    const response = await this.client.post<ApiResponse<SystemNotification>>(
      "/notifications/send",
      payload,
    );
    return response.payload;
  }

  async update(
    id: number | string,
    payload: Partial<CreateNotificationRequest>,
  ): Promise<SystemNotification> {
    const response = await this.client.put<ApiResponse<SystemNotification>>(
      `/notifications/${id}`,
      payload,
    );
    return response.payload;
  }

  async remove(id: number | string): Promise<void> {
    await this.client.delete<ApiResponse<null>>(`/notifications/${id}`);
  }

  // ===== Thông báo của người dùng hiện tại =====

  async listMine(onlyUnseen = false): Promise<SystemNotification[]> {
    const response = await this.client.get<ApiResponse<SystemNotification[]>>(
      `/notifications/me${onlyUnseen ? "?unseen=1" : ""}`,
    );
    return response.payload;
  }

  async getUnseenCount(): Promise<number> {
    const response = await this.client.get<ApiResponse<{ total: number }>>(
      "/notifications/me/unseen-count",
    );
    return response.payload.total;
  }

  async markSeen(id: number | string): Promise<void> {
    await this.client.patch<ApiResponse<null>>(`/notifications/${id}/seen`);
  }

  async markAllSeen(): Promise<void> {
    await this.client.patch<ApiResponse<null>>("/notifications/me/seen-all");
  }
}

export const notificationService = new NotificationService();
