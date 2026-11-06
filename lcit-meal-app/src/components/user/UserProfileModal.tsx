import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import {
    userService,
    paymentService,
    mealOptionService,
    ApiError,
    type Payment,
    type MealOption,
} from "@/api";

const ROLE_LABEL: Record<string, string> = {
    admin: "Quản trị viên",
    manager: "Quản lý",
    employee: "Nhân viên",
    kitchen: "Bếp ăn",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    overdue: "Quá hạn",
};

const OPTION_STATUS_LABEL: Record<string, string> = {
    pending: "Đang chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Bị từ chối",
};

const OPTION_TYPE_LABEL: Record<string, string> = {
    cancel_today: "Cắt hôm nay",
    cancel_schedule: "Cắt theo khoảng ngày",
    cancel_permanent: "Cắt hẳn",
};

const formatCurrency = (v: number | null) =>
    v === null ? "-" : `${new Intl.NumberFormat("vi-VN").format(Number(v))}đ`;

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export default function UserProfileModal({ isOpen, onClose }: Props) {
    const { user, setUser } = useAuth();
    const { showNotification } = useNotification();

    const [fullName, setFullName] = useState(user?.fullName ?? "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const [payments, setPayments] = useState<Payment[]>([]);
    const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Nạp lại dữ liệu mỗi lần modal được mở (tránh gọi API khi modal đang đóng)
    useEffect(() => {
        if (!isOpen) return;

        setFullName(user?.fullName ?? "");
        setPassword("");
        setConfirmPassword("");
        setIsLoading(true);

        Promise.all([paymentService.listMine(), mealOptionService.listMine()])
            .then(([p, o]) => {
                setPayments(p);
                setMealOptions(o);
            })
            .catch((error) => {
                showNotification(
                    error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu cá nhân",
                    "error",
                );
            })
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password && password !== confirmPassword) {
            showNotification("Mật khẩu xác nhận không khớp.", "error");
            return;
        }
        if (password && password.length < 6) {
            showNotification("Mật khẩu mới phải có ít nhất 6 ký tự.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const res = await userService.updateProfile({
                fullName: fullName.trim() || undefined,
                password: password || undefined,
            });
            setUser(res.payload);
            setPassword("");
            setConfirmPassword("");
            showNotification("Đã cập nhật hồ sơ.", "success");
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi cập nhật hồ sơ",
                "error",
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <Modal
            isOpen
            onClose={onClose}
            className="m-4 max-w-2xl overflow-hidden dark:bg-gray-900"
        >
            <div className="max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900">
                {/* Header */}
                <div className="flex items-center gap-4 border-b border-gray-200 p-6 dark:border-gray-800">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-600 dark:bg-brand-500/10">
                        {user?.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                            {user?.fullName}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            @{user?.username} —{" "}
                            {user?.roles.map((r) => ROLE_LABEL[r.code] ?? r.displayName).join(", ") || "Chưa gán vai trò"}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    {/* Form chỉnh sửa */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Họ và tên
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Mật khẩu mới
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Để trống nếu không đổi"
                                    autoComplete="new-password"
                                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Xác nhận mật khẩu mới
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </form>

                    {/* Lịch sử thanh toán của tôi */}
                    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Lịch sử thanh toán
                        </h3>
                        {isLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
                        ) : payments.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có kỳ thanh toán nào.</p>
                        ) : (
                            <div className="max-h-40 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                                {payments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                                        <span className="text-gray-600 dark:text-gray-300">{p.paymentDate}</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(p.amount)}
                                        </span>
                                        <span
                                            className={
                                                p.status === "paid"
                                                    ? "text-emerald-600"
                                                    : p.status === "overdue"
                                                        ? "text-red-600"
                                                        : "text-amber-600"
                                            }
                                        >
                                            {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Yêu cầu hủy ăn của tôi */}
                    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                            Yêu cầu hủy ăn gần đây
                        </h3>
                        {isLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
                        ) : mealOptions.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có yêu cầu nào.</p>
                        ) : (
                            <div className="max-h-40 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                                {mealOptions.map((o) => (
                                    <div key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                                        <div>
                                            <p className="text-gray-800 dark:text-gray-200">
                                                {OPTION_TYPE_LABEL[o.type] ?? o.type}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {o.fromDate} → {o.toDate}
                                            </p>
                                        </div>
                                        <span
                                            className={
                                                o.status === "approved"
                                                    ? "text-emerald-600"
                                                    : o.status === "rejected"
                                                        ? "text-red-600"
                                                        : "text-amber-600"
                                            }
                                        >
                                            {OPTION_STATUS_LABEL[o.status] ?? o.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>,
        document.body,
    );
}
