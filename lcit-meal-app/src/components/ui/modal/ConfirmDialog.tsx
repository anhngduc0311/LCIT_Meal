import { Modal } from "./index";
import type { ConfirmVariant } from "@/context/ConfirmContext";

type Props = {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

const CONFIRM_BUTTON_CLASS: Record<ConfirmVariant, string> = {
  default: "bg-brand-500 hover:bg-brand-600",
  danger: "bg-red-600 hover:bg-red-700",
};

const ConfirmDialog: React.FC<Props> = ({
  isOpen,
  title = "Xác nhận",
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "default",
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={false}
      className="max-w-md m-4 overflow-hidden dark:bg-gray-900"
    >
      <div className="space-y-4 bg-white p-6 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
          {message}
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
          >
            {cancelText}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${CONFIRM_BUTTON_CLASS[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
