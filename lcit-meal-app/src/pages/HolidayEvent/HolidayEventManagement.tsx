import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import { useClientPagination } from "@/hooks/useClientPagination";
import Pagination from "@/components/common/Pagination";
import {
    holidayEventService,
    ApiError,
    type HolidayEvent,
} from "@/api";

const todayISO = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());

const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("vi-VN").format(date);
};

const STATUS_LABEL: Record<HolidayEvent["status"], string> = {
    active: "Đang áp dụng",
    restored: "Đã mở lại",
};

const STATUS_CLASS: Record<HolidayEvent["status"], string> = {
    active: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    restored: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

const HolidayEventManagement: React.FC = () => {
    const { showNotification } = useNotification();
    const confirm = useConfirm();

    const [events, setEvents] = useState<HolidayEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const [name, setName] = useState("");
    const [reason, setReason] = useState("");
    const [fromDate, setFromDate] = useState(todayISO());
    const [toDate, setToDate] = useState(todayISO());
    const [isSingleDay, setIsSingleDay] = useState(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await holidayEventService.list();
            setEvents(data);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải danh sách sự kiện hủy lịch",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Bảng lịch sử hủy lịch có thể dài dần theo thời gian - phân trang
    // phía client thay vì render toàn bộ.
    const {
        paginatedItems: paginatedEvents,
        pagination: paginationMeta,
        setPage: setClientPage,
        setLimit: setClientLimit,
    } = useClientPagination(events, String(events.length));

    const resetForm = () => {
        setName("");
        setReason("");
        setFromDate(todayISO());
        setToDate(todayISO());
        setIsSingleDay(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            showNotification("Vui lòng nhập tên sự kiện.", "error");
            return;
        }
        const effectiveToDate = isSingleDay ? fromDate : toDate;
        if (effectiveToDate < fromDate) {
            showNotification("Ngày kết thúc không thể trước ngày bắt đầu.", "error");
            return;
        }

        const ok = await confirm({
            title: "Xác nhận hủy lịch",
            message: `Xác nhận hủy lịch "${name.trim()}" từ ${fromDate} đến ${effectiveToDate}? Toàn bộ bếp ăn và suất ăn đã đăng ký của TẤT CẢ cán bộ trong khoảng ngày này sẽ bị hủy.`,
            confirmText: "Hủy lịch",
            variant: "danger",
        });
        if (!ok) return;

        setIsBusy(true);
        try {
            await holidayEventService.create({
                name: name.trim(),
                reason: reason || undefined,
                fromDate,
                toDate: effectiveToDate,
            });
            showNotification(
                `Đã hủy lịch "${name.trim()}" từ ${fromDate} đến ${effectiveToDate}. Toàn bộ suất ăn đã đăng ký trong khoảng này đã được hủy.`,
                "success",
            );
            resetForm();
            await load();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setIsBusy(false);
        }
    };

    const handleRestore = async (event: HolidayEvent) => {
        const ok = await confirm({
            title: "Xác nhận mở lại lịch ăn",
            message: `Mở lại lịch ăn cho sự kiện "${event.name}"? Các suất ăn đã bị hủy sẽ KHÔNG tự đăng ký lại.`,
            confirmText: "Mở lại",
        });
        if (!ok) return;
        setBusyId(event.id);
        try {
            await holidayEventService.restore(event.id);
            showNotification("Đã mở lại bếp ăn cho khoảng ngày này.", "success");
            await load();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <PageMeta
                title="Hủy lịch | Hệ thống quản lý suất ăn"
                description="Hủy lịch ăn cho ngày lễ, Tết hoặc sự kiện của cơ quan"
            />
            <div className="grid grid-cols-12 gap-4 md:gap-6">
                <div className="col-span-12 lg:col-span-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                            Hủy lịch (nghỉ lễ / Tết / sự kiện)
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Dùng khi cơ quan có lịch nghỉ. Hệ thống sẽ tự động hủy bếp ăn và
                            toàn bộ suất ăn đã đăng ký của TẤT CẢ cán bộ trong khoảng ngày này.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Tên sự kiện
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="VD: Nghỉ Tết Nguyên Đán"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Lý do (tùy chọn)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="VD: Nghỉ theo lịch nghỉ lễ của cơ quan"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="single-day"
                                    type="checkbox"
                                    checked={isSingleDay}
                                    onChange={(e) => setIsSingleDay(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="single-day" className="text-sm text-gray-700 dark:text-gray-300">
                                    Chỉ nghỉ 1 ngày
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {isSingleDay ? "Ngày nghỉ" : "Từ ngày"}
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    />
                                </div>
                                {!isSingleDay && (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Đến ngày
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isBusy}
                                className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {isBusy ? "Đang xử lý..." : "Hủy lịch"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-7">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                        <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
                            Lịch sử hủy lịch
                        </h3>
                        {isLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
                        ) : events.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Chưa có sự kiện hủy lịch nào.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="px-3 py-2 font-medium text-gray-500">Sự kiện</th>
                                            <th className="px-3 py-2 font-medium text-gray-500">Khoảng ngày</th>
                                            <th className="px-3 py-2 font-medium text-gray-500">Trạng thái</th>
                                            <th className="px-3 py-2 font-medium text-gray-500">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {paginatedEvents.map((event) => (
                                            <tr key={event.id}>
                                                <td className="px-3 py-2">
                                                    <p className="font-medium text-gray-900 dark:text-white/90">
                                                        {event.name}
                                                    </p>
                                                    {event.reason && (
                                                        <p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                                                            {event.reason}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">
                                                    {formatDate(event.fromDate)}
                                                    {event.fromDate !== event.toDate ? ` - ${formatDate(event.toDate)}` : ""}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[event.status]}`}>
                                                        {STATUS_LABEL[event.status]}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {event.status === "active" ? (
                                                        <button
                                                            type="button"
                                                            disabled={busyId === event.id}
                                                            onClick={() => void handleRestore(event)}
                                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                                                        >
                                                            Mở lại
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!isLoading && events.length > 0 && (
                            <div className="mt-4">
                                <Pagination
                                    pagination={paginationMeta}
                                    onPageChange={setClientPage}
                                    onLimitChange={setClientLimit}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default HolidayEventManagement;