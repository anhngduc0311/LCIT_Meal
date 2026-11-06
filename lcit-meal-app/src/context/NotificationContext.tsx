import { createContext } from "react";

export type NotificationStatus = "success" | "error" | "info" | "warning";

export type NotificationState = {
    message: string;
    status: NotificationStatus;
};

export type NotificationContextValue = {
    notification: NotificationState | null;
    showNotification: (message: string, status?: NotificationStatus) => void;
    hideNotification: () => void;
};

export const NotificationContext = createContext<NotificationContextValue | null>(null);