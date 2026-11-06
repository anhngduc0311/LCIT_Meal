import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { NotificationStatus } from "../../context/NotificationContext";

type NotificationProps = {
    message?: string;
    status?: NotificationStatus;
    onClose?: () => void;
};

const styles: Record<NotificationStatus, { container: string; icon: React.ReactNode }> = {
    success: {
        container: "border-success-200 bg-success-50 text-success-800",
        icon: <CircleCheck className="size-5 shrink-0 text-success-600" aria-hidden="true" />,
    },
    error: {
        container: "border-error-200 bg-error-50 text-error-800",
        icon: <CircleAlert className="size-5 shrink-0 text-error-600" aria-hidden="true" />,
    },
    info: {
        container: "border-blue-light-200 bg-blue-light-50 text-blue-light-800",
        icon: <Info className="size-5 shrink-0 text-blue-light-600" aria-hidden="true" />,
    },
    warning: {
        container: "border-warning-200 bg-warning-50 text-warning-800",
        icon: <CircleAlert className="size-5 shrink-0 text-warning-600" aria-hidden="true" />,
    },
};

const Notification: React.FC<NotificationProps> = ({ message, status = "info", onClose }) => {
    if (!message) return null;

    return (
        <div
            role="status"
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-theme-md ${styles[status].container}`}
        >
            {styles[status].icon}
            <p className="min-w-0 flex-1 text-sm font-medium">{message}</p>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng thông báo"
                    className="-mr-1 -mt-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
};

export default Notification;