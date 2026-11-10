/**
 * Types - Notifications
 * Khớp với backend Notification.js và NotificationController.js
 */

export type NotificationType =
  | 'LATE_REGISTRATION'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'APPROVAL'
  | 'SYSTEM'
  | string;

export interface NotificationItem {
  id: number;
  title: string;
  content: string;
  url?: string | null;
  imageUri?: string;
  type?: NotificationType;
  status?: string;
  createdAt: string;
  createdBy?: number | null;
  creatorName?: string;
  // Bảng trung gian notification_recipient
  isSeen?: boolean | number;
  seenAt?: string | null;
}

export interface UnseenCountResponse {
  total: number;
  count?: number;
}

export interface SendNotificationRequest {
  title: string;
  content: string;
  url?: string;
  image?: { uri: string; name: string; mimeType: string; file?: File };
  type?: string;
  userIds?: number[]; // Nếu để trống/không gửi -> broadcast cho toàn bộ cán bộ active
}

export interface CreateNotificationRequest {
  title: string;
  content: string;
  url?: string;
  type?: string;
  status?: string;
}

export interface UpdateNotificationRequest {
  title?: string;
  content?: string;
  url?: string;
  type?: string;
  status?: string;
}
