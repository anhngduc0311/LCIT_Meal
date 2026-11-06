import { useCallback, useEffect, useState } from "react";
import { ApiError, mealOptionService, type MealOption } from "@/api";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import { useClientPagination } from "@/hooks/useClientPagination";
import Pagination from "@/components/common/Pagination";
import PageMeta from "@/components/common/PageMeta";
import { pageMeta } from "../PageMeta";

const todayISO = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());

const TYPE_LABELS: Record<MealOption["type"], string> = {
    cancel_today: "Cắt hôm nay",
    cancel_schedule: "Cắt theo khoảng ngày",
    cancel_permanent: "Cắt hẳn",
};

const STATUS_LABELS: Record<MealOption["status"], string> = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
};

const statusClass: Record<MealOption["status"], string> = {
    pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    rejected: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("vi-VN").format(date);
};

const MealOptionManagement: React.FC = () => {
    const { showNotification } = useNotification();
    const confirm = useConfirm();
    const [items, setItems] = useState<MealOption[]>([]);
    // Nghiệp vụ mới: cắt suất được duyệt tự động nên gần như không còn bản
    // ghi "pending" -> mặc định hiển thị tất cả thay vì lọc theo chờ duyệt.
    const [status, setStatus] = useState<"all" | MealOption["status"]>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);

    const loadOptions = useCallback(async () => {
        setIsLoading(true);
        try {
            const options = await mealOptionService.list();
            setItems(options);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Không thể tải yêu cầu cắt suất ăn",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        void loadOptions();
    }, [loadOptions]);

    const handleDecision = async (item: MealOption, decision: "approve" | "reject") => {
        if (decision === "approve") {
            const ok = await confirm({
                title: "Xác nhận duyệt yêu cầu",
                message: `Xác nhận duyệt yêu cầu cắt suất ăn của ${item.userName || `User #${item.userId}`} (${TYPE_LABELS[item.type]}, ${formatDate(item.fromDate)} - ${formatDate(item.toDate)})?`,
                confirmText: "Duyệt",
            });
            if (!ok) return;

            setBusyId(item.id);
            try {
                await mealOptionService.approve(item.id);
                showNotification("Đã duyệt yêu cầu cắt suất ăn.", "success");
                await loadOptions();
            } catch (error) {
                showNotification(
                    error instanceof ApiError ? error.message : "Không thể cập nhật yêu cầu",
                    "error",
                );
            } finally {
                setBusyId(null);
            }
            return;
        }

        const note = window.prompt("Lý do từ chối (tùy chọn):", "");
        if (note === null) return;

        const ok = await confirm({
            title: "Xác nhận từ chối yêu cầu",
            message: `Xác nhận từ chối yêu cầu cắt suất ăn của ${item.userName || `User #${item.userId}`}?`,
            confirmText: "Từ chối",
            variant: "danger",
        });
        if (!ok) return;

        setBusyId(item.id);
        try {
            await mealOptionService.reject(item.id, note);
            showNotification("Đã từ chối yêu cầu cắt suất ăn.", "success");
            await loadOptions();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Không thể cập nhật yêu cầu",
                "error",
            );
        } finally {
            setBusyId(null);
        }
    };

    // Xác nhận người dùng đăng ký ăn lại - áp dụng cho yêu cầu "cắt hẳn"
    // (cancel_permanent) hoặc "cắt theo khoảng ngày" (cancel_schedule) ĐÃ
    // DUYỆT và vẫn đang còn hiệu lực (to_date >= hôm nay). Với cắt vĩnh
    // viễn, đây là cách DUY NHẤT để user đăng ký ăn lại vì to_date của loại
    // này không tự hết hạn.
    const handleReactivate = async (item: MealOption) => {
        const ok = await confirm({
            title: "Xác nhận đăng ký ăn lại",
            message: `Xác nhận kết thúc yêu cầu cắt suất ăn của ${item.userName || `User #${item.userId}`}? Từ hôm nay, người này sẽ được đăng ký ăn lại bình thường.`,
            confirmText: "Xác nhận đăng ký lại",
        });
        if (!ok) return;

        setBusyId(item.id);
        try {
            await mealOptionService.reactivate(item.id);
            showNotification("Đã xác nhận đăng ký ăn lại.", "success");
            await loadOptions();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Không thể cập nhật yêu cầu",
                "error",
            );
        } finally {
            setBusyId(null);
        }
    };

    const canReactivate = (item: MealOption) =>
        item.status === "approved" &&
        (item.type === "cancel_permanent" || item.type === "cancel_schedule") &&
        item.toDate >= todayISO();

    const filteredItems = status === "all" ? items : items.filter((item) => item.status === status);

    // Danh sách yêu cầu cắt suất ăn tích lũy theo thời gian - phân trang
    // phía client trên kết quả đã lọc theo trạng thái.
    const {
        paginatedItems: paginatedOptions,
        pagination: paginationMeta,
        setPage: setClientPage,
        setLimit: setClientLimit,
    } = useClientPagination(filteredItems, status);

    return (
        <>
            <PageMeta
                title={pageMeta.mealOption.title}
                description={pageMeta.mealOption.description}
            />
            <div className="p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">
                            Theo dõi cắt suất ăn
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Cán bộ tự cắt suất và được duyệt tự động. Trang này để theo
                            dõi, xác nhận đăng ký ăn lại, và xử lý nốt các yêu cầu cũ
                            còn chờ duyệt.
                        </p>
                    </div>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as typeof status)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                        <option value="pending">Chờ duyệt</option>
                        <option value="all">Tất cả</option>
                        <option value="approved">Đã duyệt</option>
                        <option value="rejected">Từ chối</option>
                    </select>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    {isLoading ? (
                        <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Đang tải yêu cầu...</p>
                    ) : filteredItems.length === 0 ? (
                        <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Không có yêu cầu phù hợp.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-gray-500">Cán bộ</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">Loại yêu cầu</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">Khoảng ngày</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">Lý do</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">Trạng thái</th>
                                        <th className="px-4 py-3 font-medium text-gray-500">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {paginatedOptions.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white/90">
                                                {item.userName || `User #${item.userId}`}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {TYPE_LABELS[item.type]}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {formatDate(item.fromDate)} - {formatDate(item.toDate)}
                                            </td>
                                            <td className="max-w-xs truncate px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {item.note || "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[item.status]}`}>
                                                    {STATUS_LABELS[item.status]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.status === "pending" ? (
                                                    <div className="flex gap-2 whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            disabled={busyId === item.id}
                                                            onClick={() => void handleDecision(item, "approve")}
                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                                        >
                                                            Duyệt
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busyId === item.id}
                                                            onClick={() => void handleDecision(item, "reject")}
                                                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-50"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                ) : canReactivate(item) ? (
                                                    <button
                                                        type="button"
                                                        disabled={busyId === item.id}
                                                        onClick={() => void handleReactivate(item)}
                                                        className="whitespace-nowrap rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-600 disabled:opacity-50 dark:border-brand-800 dark:text-brand-400"
                                                    >
                                                        Xác nhận đăng ký lại
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Đã xử lý</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!isLoading && filteredItems.length > 0 && (
                        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                            <Pagination
                                pagination={paginationMeta}
                                onPageChange={setClientPage}
                                onLimitChange={setClientLimit}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default MealOptionManagement;