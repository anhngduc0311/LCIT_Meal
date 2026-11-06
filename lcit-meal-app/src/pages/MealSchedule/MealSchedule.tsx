import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/api/types/auth";
import {
    mealService,
    userService,
    adminToolsService,
    ApiError,
    type Meal,
    type MealSummary,
    type MealRegistration,
} from "@/api";

const pad2 = (n: number) => String(n).padStart(2, "0");
const currentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

const monthRange = (year: number, month: number) => {
    const from = `${year}-${pad2(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
    return { from, to, lastDay };
};

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const toMondayIndex = (jsDay: number) => (jsDay + 6) % 7;

const REG_STATUS_LABEL: Record<string, string> = {
    confirmed: "Đã đăng ký",
    completed: "Đã hoàn thành",
    pending: "Chờ duyệt",
    cancelled: "Đã hủy",
};

// Nhãn cụ thể của bản ghi đang chờ duyệt: xin đăng ký hay xin cắt suất.
const getRegistrationLabel = (registration: MealRegistration) => {
    if (registration.status === "pending") {
        return registration.requestType === "cancel" ? "Chờ duyệt cắt suất" : "Chờ duyệt đăng ký";
    }
    return REG_STATUS_LABEL[registration.status] ?? registration.status;
};

const REG_STATUS_CLASS: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    completed: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
    pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const MealSchedule: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const confirm = useConfirm();
    const isManager = useMemo(
        () => user?.roles.some((r) => r.code === "admin" || r.code === "manager") ?? false,
        [user],
    );

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    const [meals, setMeals] = useState<Meal[]>([]);
    // Số yêu cầu đăng ký/cắt suất đang chờ duyệt theo từng ngày (chỉ admin/manager)
    const [pendingByDate, setPendingByDate] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false);

    const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
    const [summary, setSummary] = useState<MealSummary | null>(null);
    const { isOpen: isDetailOpen, openModal: openDetail, closeModal: closeDetail } = useModal(false);

    // Modal "Tạo suất ăn cho tháng" - chọn 1 tháng, hệ thống sẽ kiểm tra
    // tháng đó đã có lịch ăn chưa, nếu chưa thì gọi job tự động tạo bếp
    // ăn + đăng ký cho toàn bộ tháng (loại trừ các ngày rơi vào sự kiện
    // hủy lịch đang active).
    const { isOpen: isCreateOpen, openModal: openCreate, closeModal: closeCreate } = useModal(false);
    const [scheduleMonth, setScheduleMonth] = useState(currentMonthValue());
    const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

    // Danh sách cán bộ + đăng ký của họ cho ngày đang xem (chỉ admin/manager)
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [dayRegistrations, setDayRegistrations] = useState<MealRegistration[]>([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);
    const [staffQuery, setStaffQuery] = useState("");
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const { from, to } = monthRange(year, month);
            const data = await mealService.filterMeals({ from, to });
            setMeals(data);

            if (isManager) {
                const pending = await mealService
                    .filterRegistrations({ from, to, status: "pending" })
                    .catch(() => []);
                const counts: Record<string, number> = {};
                pending.forEach((r) => {
                    if (r.mealDate) counts[r.mealDate] = (counts[r.mealDate] ?? 0) + 1;
                });
                setPendingByDate(counts);
            }
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải lịch bếp ăn",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month, isManager]);

    useEffect(() => {
        load();
    }, [load]);

    // Danh sách toàn bộ user active chỉ cần tải 1 lần (admin/manager)
    useEffect(() => {
        if (!isManager) return;
        userService
            .list({ status: "1" })
            .then((res) => setAllUsers(res.payload))
            .catch(() => setAllUsers([]));
    }, [isManager]);

    const { lastDay } = monthRange(year, month);
    const dates = useMemo(
        () =>
            Array.from({ length: lastDay }, (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`),
        [year, month, lastDay],
    );

    const leadingCount = toMondayIndex(new Date(dates[0]).getDay());

    const goToMonth = (offset: number) => {
        const d = new Date(year, month - 1 + offset, 1);
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
    };

    const loadStaffForDay = async (mealId: number) => {
        if (!isManager) return;
        setIsLoadingStaff(true);
        try {
            const regs = await mealService.listRegistrationsByMeal(mealId);
            setDayRegistrations(regs);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải danh sách cán bộ",
                "error",
            );
        } finally {
            setIsLoadingStaff(false);
        }
    };

    const openDayDetail = async (meal: Meal) => {
        setSelectedMeal(meal);
        setSummary(null);
        setDayRegistrations([]);
        setStaffQuery("");
        openDetail();
        try {
            const data = await mealService.getMealSummary(meal.id);
            setSummary(data);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải chi tiết bếp ăn",
                "error",
            );
        }
        loadStaffForDay(meal.id);
    };

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        setIsBusy(true);
        try {
            await action();
            showNotification(successMessage, "success");
            await load();
            closeDetail();
            closeCreate();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setIsBusy(false);
        }
    };

    // "Tạo lịch ăn" cho cả 1 tháng. KHÔNG khóa khi tháng đã có lịch: mỗi lần
    // bấm hệ thống kiểm tra TẤT CẢ người dùng đang hoạt động - ai đã có lịch
    // thì bỏ qua, ai chưa có (vd người dùng mới) thì được tạo từ hôm nay (hoặc
    // ngày mai nếu đã qua giờ hoàn thành suất ăn) đến hết tháng. Backend tự
    // loại trừ các ngày nghỉ (holiday_event) và ngày ngoài lịch ăn trong tuần.
    const handleGenerateMonthSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        const [y, m] = scheduleMonth.split("-").map(Number);
        const monthLabel = `${pad2(m)}/${y}`;

        const ok = await confirm({
            title: "Xác nhận tạo lịch ăn cho tháng",
            message: `Xác nhận tạo lịch ăn cho tháng ${monthLabel}? Hệ thống sẽ kiểm tra toàn bộ người dùng: ai đã có lịch thì bỏ qua, ai chưa có sẽ được tạo từ hôm nay (hoặc ngày mai nếu đã qua giờ hoàn thành suất ăn) đến hết tháng, trừ những ngày có sự kiện nghỉ lịch.`,
            confirmText: "Tạo lịch ăn",
        });
        if (!ok) return;

        setIsGeneratingSchedule(true);
        try {
            const result = await adminToolsService.runAutoSchedule(scheduleMonth);

            const skipNotes = [
                result.skippedHolidayDates
                    ? `${result.skippedHolidayDates} ngày theo sự kiện nghỉ lịch`
                    : null,
                result.skippedNonScheduleDates
                    ? `${result.skippedNonScheduleDates} ngày không nằm trong lịch ăn trong tuần`
                    : null,
            ].filter(Boolean);

            const createdRegistrations = result.createdRegistrations ?? 0;
            const summary =
                createdRegistrations > 0
                    ? `Đã bổ sung ${createdRegistrations} đăng ký cho ${result.usersScheduled ?? 0} người dùng` +
                    ` (${result.createdMeals ?? 0} bếp ăn mới)`
                    : "Không có người dùng nào cần bổ sung lịch, tất cả đã có lịch ăn";

            showNotification(
                `Tháng ${monthLabel}${result.startDate ? ` (từ ${result.startDate})` : ""}: ${summary}` +
                (skipNotes.length ? `, bỏ qua ${skipNotes.join(", ")}.` : "."),
                "success",
            );
            await load();
            closeCreate();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setIsGeneratingSchedule(false);
        }
    };

    // Duyệt / từ chối yêu cầu đăng ký hoặc cắt suất (sau giờ chốt) của 1 cán bộ.
    const handleResolveRequest = async (
        targetUser: User,
        registration: MealRegistration,
        decision: "approve" | "reject",
    ) => {
        if (!selectedMeal) return;
        const isCancel = registration.requestType === "cancel";
        const what = isCancel ? "cắt suất" : "đăng ký suất ăn";
        const ok = await confirm({
            title: decision === "approve" ? `Duyệt yêu cầu ${what}` : `Từ chối yêu cầu ${what}`,
            message: `${decision === "approve" ? "Duyệt" : "Từ chối"} yêu cầu ${what} của ${targetUser.fullName} ngày ${selectedMeal.mealDate}?`,
            confirmText: decision === "approve" ? "Duyệt" : "Từ chối",
            variant: decision === "approve" ? "default" : "danger",
        });
        if (!ok) return;
        setBusyUserId(targetUser.id);
        try {
            if (decision === "approve") {
                await mealService.approveRegistration(registration.id);
            } else {
                await mealService.rejectRegistration(registration.id);
            }
            showNotification(
                `Đã ${decision === "approve" ? "duyệt" : "từ chối"} yêu cầu ${what} của ${targetUser.fullName}.`,
                "success",
            );
            await Promise.all([
                loadStaffForDay(selectedMeal.id),
                mealService.getMealSummary(selectedMeal.id).then(setSummary),
                load(),
            ]);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setBusyUserId(null);
        }
    };

    const handleCancelMeal = async () => {
        if (!selectedMeal) return;
        const note = window.prompt("Lý do hủy bếp ăn ngày này:", "") ?? "";
        const ok = await confirm({
            title: "Xác nhận hủy bếp ăn",
            message: `Bạn có chắc chắn muốn hủy bếp ăn ngày ${selectedMeal.mealDate}? Toàn bộ suất ăn đã đăng ký trong ngày này sẽ bị ảnh hưởng.`,
            confirmText: "Hủy bếp ăn",
            variant: "danger",
        });
        if (!ok) return;
        runAction(
            () => mealService.cancelMeal(selectedMeal.id, note).then(() => { }),
            "Đã hủy bếp ăn ngày " + selectedMeal.mealDate,
        );
    };

    const handleRestoreMeal = async () => {
        if (!selectedMeal) return;
        const ok = await confirm({
            title: "Xác nhận mở lại bếp ăn",
            message: `Xác nhận mở lại bếp ăn ngày ${selectedMeal.mealDate}?`,
            confirmText: "Mở lại",
        });
        if (!ok) return;
        runAction(
            () => mealService.restoreMeal(selectedMeal.id).then(() => { }),
            "Đã mở lại bếp ăn ngày " + selectedMeal.mealDate,
        );
    };

    // Đăng ký / cắt suất HỘ 1 cán bộ cụ thể (chỉ admin/manager) - không đóng
    // modal, chỉ nạp lại danh sách + tổng hợp để admin thao tác liên tục
    // cho nhiều người mà không phải mở lại modal mỗi lần.
    const handleToggleStaffRegistration = async (
        targetUser: User,
        registration: MealRegistration | undefined,
    ) => {
        if (!selectedMeal) return;
        const isCancelling = registration && registration.status !== "cancelled";
        const ok = await confirm({
            title: isCancelling ? "Xác nhận cắt suất ăn" : "Xác nhận đăng ký suất ăn",
            message: isCancelling
                ? `Xác nhận cắt suất ăn của ${targetUser.fullName} ngày ${selectedMeal.mealDate}?`
                : `Xác nhận đăng ký suất ăn cho ${targetUser.fullName} ngày ${selectedMeal.mealDate}?`,
            confirmText: isCancelling ? "Cắt suất" : "Đăng ký",
            variant: isCancelling ? "danger" : "default",
        });
        if (!ok) return;
        setBusyUserId(targetUser.id);
        try {
            if (isCancelling && registration) {
                await mealService.cancelRegistration(registration.id);
                showNotification(`Đã cắt suất ăn của ${targetUser.fullName}.`, "success");
            } else {
                await mealService.register({
                    mealId: selectedMeal.id,
                    guestCount: 0,
                    userId: targetUser.id,
                });
                showNotification(`Đã đăng ký suất ăn cho ${targetUser.fullName}.`, "success");
            }
            await Promise.all([loadStaffForDay(selectedMeal.id), (async () => {
                const data = await mealService.getMealSummary(selectedMeal.id);
                setSummary(data);
            })()]);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setBusyUserId(null);
        }
    };

    // Admin là tài khoản quản lý hệ thống thuần túy, không tự ăn suất ăn ->
    // không hiển thị trong danh sách để đăng ký/cắt suất hộ (khớp với chặn
    // ở backend MealRegistrationService#assertNotAdminSelfService).
    const filteredStaff = allUsers.filter(
        (u) =>
            u.fullName.toLowerCase().includes(staffQuery.toLowerCase()) &&
            !u.roles.some((r) => r.code === "admin"),
    );

    return (
        <>
            <PageMeta
                title="Lịch bếp ăn | Hệ thống quản lý suất ăn"
                description="Quản lý lịch bếp ăn theo ngày"
            />
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                            Lịch bếp ăn tháng {pad2(month)}/{year}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isManager
                                ? "Tạo, hủy/mở lại bếp ăn theo ngày. Bấm vào 1 ngày để đăng ký/cắt suất hộ cán bộ."
                                : "Xem lịch bếp ăn toàn hệ thống"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => goToMonth(-1)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:text-gray-300"
                        >
                            ← Tháng trước
                        </button>
                        <button
                            type="button"
                            onClick={() => goToMonth(1)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:text-gray-300"
                        >
                            Tháng sau →
                        </button>
                        {isManager && (
                            <button
                                type="button"
                                onClick={() => {
                                    setScheduleMonth(`${year}-${pad2(month)}`);
                                    openCreate();
                                }}
                                className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm text-white"
                            >
                                Tạo lịch ăn
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-2 hidden grid-cols-7 gap-3 lg:grid">
                    {WEEKDAY_LABELS.map((label) => (
                        <div
                            key={label}
                            className="text-center text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {isLoading ? (
                    <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                        {Array.from({ length: leadingCount }).map((_, i) => (
                            <div key={`empty-${i}`} className="hidden lg:block" />
                        ))}
                        {dates.map((dateStr) => {
                            const meal = meals.find((m) => m.mealDate === dateStr);
                            const dayNum = Number(dateStr.slice(-2));

                            let badgeClass = "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400";
                            let badgeText = "Chưa lên lịch";
                            if (meal?.isCancelled) {
                                badgeClass = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
                                badgeText = "Đã hủy";
                            } else if (meal?.completionStatus === "completed") {
                                badgeClass = "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300";
                                badgeText = "Đã hoàn thành";
                            } else if (meal?.completionStatus === "pending") {
                                badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
                                badgeText = "Đang chờ";
                            } else if (meal) {
                                // "serving" hoặc chưa có completionStatus (fallback giữ hành vi cũ)
                                badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
                                badgeText = "Đang phục vụ";
                            }

                            return (
                                <button
                                    type="button"
                                    key={dateStr}
                                    onClick={() => meal && openDayDetail(meal)}
                                    disabled={!meal}
                                    className={`rounded-xl border p-3 text-left transition dark:border-gray-800 ${meal
                                        ? "cursor-pointer border-gray-200 bg-white hover:ring-2 hover:ring-brand-300 dark:bg-white/[0.02]"
                                        : "cursor-default border-dashed border-gray-100 bg-gray-50 dark:bg-white/[0.01]"
                                        }`}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                            {dayNum}
                                        </span>
                                    </div>
                                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                                        {badgeText}
                                    </span>
                                    {isManager && (pendingByDate[dateStr] ?? 0) > 0 && (
                                        <span className="mt-1 block rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                                            {pendingByDate[dateStr]} chờ duyệt
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal chi tiết 1 ngày */}
            <Modal
                isOpen={isDetailOpen}
                onClose={closeDetail}
                className="m-4 max-w-2xl overflow-hidden dark:bg-gray-900"
            >
                {selectedMeal && (
                    <div className="max-h-[85vh] space-y-4 overflow-y-auto bg-white p-6 dark:bg-gray-900">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Bếp ăn ngày {selectedMeal.mealDate}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {selectedMeal.isCancelled ? "Đã hủy" : "Đang phục vụ"}
                                {selectedMeal.note ? ` — ${selectedMeal.note}` : ""}
                            </p>
                        </div>
                        {summary ? (
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Cán bộ ăn</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {summary.totalRegistrations}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Khách</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {summary.totalGuestCount}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Tổng người ăn</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {summary.totalMealSlots}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải số liệu...</p>
                        )}
                        {isManager && (
                            <div className="flex justify-end gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                                {selectedMeal.isCancelled ? (
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={handleRestoreMeal}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                                    >
                                        Mở lại bếp ăn
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={handleCancelMeal}
                                        className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50 dark:border-red-800"
                                    >
                                        Hủy bếp ăn
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Đăng ký/cắt suất hộ cán bộ - chỉ admin/manager, chỉ khi bếp chưa bị hủy */}
                        {isManager && !selectedMeal.isCancelled && (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Đăng ký / cắt suất hộ cán bộ
                                    </h4>
                                    <input
                                        type="text"
                                        placeholder="Tìm cán bộ..."
                                        value={staffQuery}
                                        onChange={(e) => setStaffQuery(e.target.value)}
                                        className="w-40 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                    />
                                </div>
                                {isLoadingStaff ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh sách cán bộ...</p>
                                ) : (
                                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                                        {filteredStaff.length === 0 && (
                                            <p className="p-2 text-sm text-gray-500 dark:text-gray-400">Không có cán bộ phù hợp.</p>
                                        )}
                                        {filteredStaff.map((staffUser) => {
                                            const registration = dayRegistrations.find((r) => r.userId === staffUser.id);
                                            const isRegistered = registration && registration.status !== "cancelled";
                                            const statusKey = registration?.status ?? "cancelled";
                                            return (
                                                <div
                                                    key={staffUser.id}
                                                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                                                            {staffUser.fullName}
                                                        </p>
                                                        <span
                                                            className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${registration
                                                                ? REG_STATUS_CLASS[statusKey]
                                                                : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                                                                }`}
                                                        >
                                                            {registration ? getRegistrationLabel(registration) : "Chưa đăng ký"}
                                                        </span>
                                                    </div>
                                                    {registration?.status === "pending" ? (
                                                        // Yêu cầu sau giờ chốt: quản lý duyệt hoặc từ chối
                                                        <div className="flex shrink-0 gap-1.5">
                                                            <button
                                                                type="button"
                                                                disabled={busyUserId === staffUser.id}
                                                                onClick={() => handleResolveRequest(staffUser, registration, "approve")}
                                                                className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-600 disabled:opacity-50 dark:border-emerald-800"
                                                            >
                                                                Duyệt
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={busyUserId === staffUser.id}
                                                                onClick={() => handleResolveRequest(staffUser, registration, "reject")}
                                                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-50 dark:border-red-800"
                                                            >
                                                                Từ chối
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={busyUserId === staffUser.id}
                                                            onClick={() => handleToggleStaffRegistration(staffUser, registration)}
                                                            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${isRegistered
                                                                ? "border-red-300 text-red-600 dark:border-red-800"
                                                                : "border-emerald-300 text-emerald-600 dark:border-emerald-800"
                                                                }`}
                                                        >
                                                            {busyUserId === staffUser.id
                                                                ? "..."
                                                                : isRegistered
                                                                    ? "Cắt suất"
                                                                    : "Đăng ký"}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Modal tạo suất ăn cho cả tháng */}
            <Modal
                isOpen={isCreateOpen}
                onClose={closeCreate}
                className="max-w-md m-4 overflow-hidden dark:bg-gray-900"
            >
                <form onSubmit={handleGenerateMonthSchedule} className="space-y-4 bg-white p-6 dark:bg-gray-900">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tạo lịch ăn cho tháng</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Chọn tháng cần tạo lịch ăn. Có thể bấm nhiều lần trong tháng (vd khi có người dùng
                        mới): người đã có lịch được bỏ qua, người chưa có lịch được tạo từ hôm nay (hoặc ngày
                        mai nếu đã qua giờ hoàn thành suất ăn) đến hết tháng. Các ngày có sự kiện nghỉ lịch
                        được loại trừ.
                    </p>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Tháng
                        </label>
                        <input
                            type="month"
                            required
                            value={scheduleMonth}
                            onChange={(e) => setScheduleMonth(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={closeCreate}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isGeneratingSchedule}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                            {isGeneratingSchedule ? "Đang tạo..." : "Tạo lịch ăn"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

export default MealSchedule;