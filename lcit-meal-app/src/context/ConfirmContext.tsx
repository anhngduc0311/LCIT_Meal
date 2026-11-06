import { createContext } from "react";

export type ConfirmVariant = "default" | "danger";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

export type ConfirmContextValue = {
  // Trả về Promise<boolean> - true nếu người dùng bấm xác nhận, false nếu hủy/đóng.
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);
