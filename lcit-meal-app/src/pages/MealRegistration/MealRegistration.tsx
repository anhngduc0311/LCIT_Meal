import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import MealStatus, { type MealStatusVariant } from "@/components/meal/MealStatus";
import {
    mdiCheckCircleOutline,
    mdiCloseCircleOutline,
    mdiClockOutline,
    mdiHelpCircleOutline,
} from "@mdi/js";
import MealQuickActions from "@/components/meal/MealQuickActions";
import MealCalendar, { type MealDay, type DayStatus } from "@/components/meal/MealCalendar";
import {
    mealService,
    mealOptionService,
    settingsService,
    ApiError,
    type Meal,
    type MealRegistration as MealRegistrationRow,
    type MealOption,
    type RegistrationWindow,
} from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";

const todayISO = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());

const pad2 = (n: number) => String(n).padStart(2, "0");

// "2026-10-01" -> "01/10"
const formatShort = (dateStr: string) => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;

const monthRange = (year: number, month: number) => {
    const from = `${year}-${pad2(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
    return { from, to, lastDay };
};

const buildDayStatus = (
    dateStr: string,
    meals: Meal[],
    myRegistrations: MealRegistrationRow[],
    myOptions: MealOption[],
): MealDay => {
    const meal = meals.find((m) => m.mealDate === dateStr);

    if (!meal) return { date: dateStr, status: "not_scheduled" };

    if (meal.isCancelled) {
        return { date: dateStr, status: "kitchen_cancelled", mealId: meal.id };
    }

    const registration = myRegistrations.find((r) => r.mealId === meal.id);

    if (registration && registration.status !== "cancelled") {
        // Logic mới: kiểm tra completionStatus của meal
        // - Nếu meal.completionStatus = "completed" (ngày đã qua hoặc quá giờ hoàn thành) ->
        //   hiển thị "completed" dù registration.status là gì
        // - Nếu registration.status = "completed" -> hiển thị "completed"
        // - Nếu registration.status = "pending" -> hiển thị "pending" (yêu cầu
        //   đăng ký/cắt suất đang chờ quản lý duyệt, xem `requestType`)
        // - Nếu registration.status = "confirmed" -> hiển thị "confirmed"
        const mealCompleted = meal.completionStatus === "completed";
        const registrationCompleted = registration.status === "completed";

        const status: DayStatus =
            mealCompleted || registrationCompleted
                ? "completed"
                : registration.status === "pending"
                    ? "pending"
                    : "confirmed";
        return {
            date: dateStr,
            status,
            mealId: meal.id,
            registrationId: registration.id,
            guestCount: registration.guestCount,
            requestType:
                status === "pending"
                    ? (registration.requestType ?? "register")
                    : undefined,
        };
    }

    const isCoveredByApprovedOption = myOptions.some(
        (option) =>
            option.status === "approved" &&
            (option.type === "cancel_permanent" || option.type === "cancel_schedule") &&
            dateStr >= option.fromDate &&
            dateStr <= option.toDate,
    );

    if (isCoveredByApprovedOption || registration?.status === "cancelled") {
        return {
            date: dateStr,
            status: "cancelled",
            mealId: meal.id,
            registrationId: registration?.id,
        };
    }

    return { date: dateStr, status: "available", mealId: meal.id };
};

type TargetUi = { message: string; variant: MealStatusVariant; icon: string };

// Nội dung thẻ trạng thái của NGÀY ĐANG PHỤC VỤ đăng ký/cắt suất (hôm nay,
// hoặc ngày kế tiếp nếu đã qua giờ hoàn thành suất ăn).
const getTargetUi = (day: MealDay | undefined): TargetUi => {
    switch (day?.status ?? "not_scheduled") {
        case "completed":
            return { message: "Đã hoàn thành", variant: "success", icon: mdiCheckCircleOutline };
        case "confirmed":
            return { message: "Đã đăng ký thành công", variant: "success", icon: mdiCheckCircleOutline };
        case "pending":
            return {
                message:
                    day?.requestType === "cancel"
                        ? "Đã gửi yêu cầu cắt suất, chờ quản lý duyệt"
                        : "Đã gửi yêu cầu đăng ký, chờ quản lý duyệt",
                variant: "info",
                icon: mdiClockOutline,
            };
        case "cancelled":
            return { message: "Đã cắt suất", variant: "danger", icon: mdiCloseCircleOutline };
        case "kitchen_cancelled":
            return { message: "Bếp ăn tạm nghỉ", variant: "neutral", icon: mdiCloseCircleOutline };
        case "available":
            return { message: "Chưa đăng ký suất ăn", variant: "neutral", icon: mdiHelpCircleOutline };
        default:
            return { message: "Chưa có lịch bếp ăn", variant: "neutral", icon: mdiHelpCircleOutline };
    }
};

const MealRegistration: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const confirm = useConfirm();

    // admin/manager đăng ký/cắt suất có hiệu lực ngay, không phải chờ duyệt.
    const isManager = useMemo(
        () => user?.roles.some((r) => r.code === "admin" || r.code === "manager") ?? false,
        [user],
    );

    const now = new Date();
    const [year] = useState(now.getFullYear());
    const [month] = useState(now.getMonth() + 1);

    const [meals, setMeals] = useState<Meal[]>([]);
    const [myRegistrations, setMyRegistrations] = useState<MealRegistrationRow[]>([]);
    const [myOptions, setMyOptions] = useState<MealOption[]>([]);
    // Cửa sổ đăng ký do backend tính (giờ chốt, giờ hoàn thành, ngày đang phục vụ)
    const [registrationWindow, setRegistrationWindow] = useState<RegistrationWindow | null>(null);
    const [mealPrice, setMealPrice] = useState("0");
    const [isLoading, setIsLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const { from, to } = monthRange(year, month);
            const windowData = await mealService.getRegistrationWindow();
            // Đã qua giờ hoàn thành ở ngày cuối tháng thì ngày đang phục vụ là
            // ngày 1 tháng sau -> tải thêm bếp ăn tới ngày đó.
            const mealsTo = windowData.targetDate > to ? windowData.targetDate : to;

            const [mealsData, registrationsData, optionsData, priceSetting] =
                await Promise.all([
                    mealService.filterMeals({ from, to: mealsTo }),
                    mealService.listMyRegistrations(),
                    mealOptionService.listMine(),
                    settingsService.getByKey("meal_price").catch(() => null),
                ]);
            setRegistrationWindow(windowData);
            setMeals(mealsData);
            setMyRegistrations(registrationsData);
            setMyOptions(optionsData);
            if (priceSetting) setMealPrice(priceSetting.setting_value);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu lịch ăn",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Ngày đang phục vụ đăng ký/cắt suất: hôm nay, hoặc NGÀY KẾ TIẾP nếu đã
    // qua giờ hoàn thành suất ăn.
    const todayStr = registrationWindow?.today ?? todayISO();
    const targetDate = registrationWindow?.targetDate ?? todayStr;
    const targetLabel =
        targetDate === todayStr ? "hôm nay" : `ngày kế tiếp (${formatShort(targetDate)})`;
    // Sau giờ chốt (chưa tới giờ hoàn thành), người dùng thường phải chờ duyệt.
    const needsApproval = registrationWindow?.targetState === "late" && !isManager;

    const calendarDays = useMemo(() => {
        const { lastDay } = monthRange(year, month);
        const days: MealDay[] = [];
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
            days.push(buildDayStatus(dateStr, meals, myRegistrations, myOptions));
        }
        return days;
    }, [year, month, meals, myRegistrations, myOptions]);

    const target = useMemo(
        () => buildDayStatus(targetDate, meals, myRegistrations, myOptions),
        [targetDate, meals, myRegistrations, myOptions],
    );

    const targetUi = getTargetUi(target);

    // action có thể trả về câu thông báo riêng (vd "đã gửi yêu cầu, chờ duyệt"
    // thay vì "thành công") tùy kết quả backend trả về.
    const runAction = async (action: () => Promise<string | void>, successMessage: string) => {
        setIsBusy(true);
        try {
            const message = await action();
            showNotification(message || successMessage, "success");
            await loadAll();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại",
                "error",
            );
        } finally {
            setIsBusy(false);
        }
    };

    // Ngày `dateStr` có phải đăng ký/cắt sau giờ chốt (=> chờ duyệt) hay không.
    const isLateDay = (dateStr: string) =>
        !isManager &&
        registrationWindow?.targetState === "late" &&
        dateStr === registrationWindow.targetDate;

    const confirmLate = async (what: string) => {
        if (!needsApproval) return true;
        return confirm({
            title: "Đã quá giờ chốt đăng ký",
            message: `Đã quá giờ chốt đăng ký${registrationWindow?.closeTime ? ` (${registrationWindow.closeTime})` : ""}. Yêu cầu ${what} ${targetLabel} sẽ được gửi cho quản lý duyệt trước khi có hiệu lực. Tiếp tục?`,
            confirmText: "Gửi yêu cầu",
        });
    };

    const registerMessage = (status: string, label: string) =>
        status === "pending"
            ? "Đã gửi yêu cầu đăng ký, đang chờ quản lý duyệt."
            : `Đăng ký suất ăn ${label} thành công.`;

    const handleRegisterTarget = async () => {
        if (!target.mealId) return;
        if (!(await confirmLate("đăng ký suất ăn"))) return;
        runAction(async () => {
            const res = await mealService.register({ mealId: target.mealId as number, guestCount: 0 });
            return registerMessage(res.status, targetLabel);
        }, "");
    };

    // Cắt suất của ngày đang phục vụ. Luồng cắt/duyệt do backend quyết định:
    // trong hạn thì cắt ngay, sau giờ chốt thì thành yêu cầu chờ duyệt.
    const handleCancelTarget = async () => {
        if (!target.registrationId) return;
        const isWithdraw = target.status === "pending"; // rút yêu cầu đăng ký chưa duyệt
        if (!isWithdraw && !(await confirmLate("cắt suất ăn"))) return;
        runAction(async () => {
            const res = await mealService.cancelRegistration(target.registrationId as number);
            if (res.status === "pending") {
                return "Đã gửi yêu cầu cắt suất, đang chờ quản lý duyệt.";
            }
            if (!isWithdraw) {
                // Ghi nhận việc cắt để quản lý theo dõi ở "Theo dõi cắt suất ăn".
                // Suất đã cắt thành công nên lỗi ở bước ghi nhận không làm hỏng thao tác.
                await mealOptionService
                    .create({ type: "cancel_today", fromDate: targetDate, toDate: targetDate })
                    .catch(() => undefined);
            }
            return isWithdraw ? "Đã rút yêu cầu đăng ký." : `Đã cắt suất ăn ${targetLabel}.`;
        }, "");
    };

    const handleCancelPermanent = (note: string) => {
        runAction(async () => {
            const option = await mealOptionService.create({
                type: "cancel_permanent",
                fromDate: targetDate,
                toDate: "9999-12-31",
                note,
            });
            return option.status === "pending"
                ? "Đã gửi yêu cầu cắt hẳn suất ăn, đang chờ quản lý duyệt."
                : `Đã cắt hẳn suất ăn kể từ ${targetLabel}.`;
        }, "");
    };

    const handleCancelCustomRange = (fromDate: string, toDate: string, note: string) => {
        runAction(async () => {
            const option = await mealOptionService.create({
                type: "cancel_schedule",
                fromDate,
                toDate,
                note,
            });
            return option.status === "pending"
                ? "Đã gửi yêu cầu cắt suất, đang chờ quản lý duyệt."
                : "Đã cắt suất ăn theo khoảng ngày đã chọn.";
        }, "");
    };

    // Đăng ký thêm suất ăn cho khách trong ngày đang phục vụ. Backend dùng
    // chung API đăng ký (UNIQUE(user_id, meal_id)) nên chỉ cần gọi register
    // với guestCount mới - bản ghi cũ sẽ được cập nhật thay vì tạo trùng.
    const handleRegisterGuest = (guestCount: number) => {
        if (!target.mealId) return;
        runAction(async () => {
            const res = await mealService.register({ mealId: target.mealId as number, guestCount });
            if (res.status === "pending") {
                return "Đã gửi yêu cầu đăng ký (kèm khách), đang chờ quản lý duyệt.";
            }
            return guestCount > 0
                ? `Đã đăng ký thêm ${guestCount} suất ăn cho khách ${targetLabel}.`
                : `Đã bỏ toàn bộ suất ăn đăng ký cho khách ${targetLabel}.`;
        }, "");
    };

    const handleDayClick = async (day: MealDay) => {
        // Chỉ thao tác được từ ngày đang phục vụ trở đi (ngày đã qua, hoặc hôm
        // nay khi đã qua giờ hoàn thành thì không còn thao tác được).
        if (day.date < targetDate) return;

        const late = isLateDay(day.date);
        const lateNote = late
            ? ` Đã quá giờ chốt đăng ký${registrationWindow?.closeTime ? ` (${registrationWindow.closeTime})` : ""} nên yêu cầu sẽ được gửi cho quản lý duyệt.`
            : "";

        if (day.status === "available" || day.status === "cancelled") {
            if (!day.mealId) return;
            const ok = await confirm({
                title: "Xác nhận đăng ký suất ăn",
                message: `Bạn có chắc chắn muốn đăng ký lại suất ăn ngày ${day.date}?${lateNote}`,
                confirmText: late ? "Gửi yêu cầu" : "Đăng ký",
            });
            if (!ok) return;
            runAction(async () => {
                const res = await mealService.register({ mealId: day.mealId as number, guestCount: 0 });
                return registerMessage(res.status, `ngày ${day.date}`);
            }, "");
        } else if (day.status === "pending" && day.requestType === "cancel") {
            showNotification("Yêu cầu cắt suất của ngày này đang chờ quản lý duyệt.", "success");
        } else if (day.status === "confirmed" || day.status === "pending") {
            if (!day.registrationId) return;
            const isWithdraw = day.status === "pending";
            const ok = await confirm({
                title: isWithdraw ? "Rút yêu cầu đăng ký" : "Xác nhận hủy suất ăn",
                message: isWithdraw
                    ? `Bạn có chắc chắn muốn rút yêu cầu đăng ký suất ăn ngày ${day.date}?`
                    : `Bạn có chắc chắn muốn hủy suất ăn ngày ${day.date}?${lateNote}`,
                confirmText: isWithdraw ? "Rút yêu cầu" : late ? "Gửi yêu cầu" : "Hủy suất ăn",
                variant: "danger",
            });
            if (!ok) return;
            runAction(async () => {
                const res = await mealService.cancelRegistration(day.registrationId as number);
                if (res.status === "pending") {
                    return `Đã gửi yêu cầu cắt suất ngày ${day.date}, đang chờ quản lý duyệt.`;
                }
                return isWithdraw
                    ? `Đã rút yêu cầu đăng ký ngày ${day.date}.`
                    : `Đã hủy suất ăn ngày ${day.date}.`;
            }, "");
        }
    };

    return (
        <>
            <PageMeta
                title="Đăng ký suất ăn | Hệ thống quản lý suất ăn"
                description="Trang đăng ký / cắt suất ăn cho cán bộ nhân viên"
            />
            <div className="grid grid-cols-12 gap-4 md:gap-6">
                <div className="col-span-12 lg:col-span-4 gap-4 md:gap-6 space-y-6">
                    <MealStatus
                        icon={targetUi.icon}
                        title={`Suất ăn ${targetLabel}`}
                        date={targetDate}
                        variant={targetUi.variant}
                        price={mealPrice}
                        message={targetUi.message}
                    />
                </div>
                <div className="col-span-12 shadow-sm lg:col-span-8 gap-4 md:gap-6 space-y-6">
                    <MealQuickActions
                        targetDate={targetDate}
                        targetLabel={targetLabel}
                        needsApproval={needsApproval}
                        closeTime={registrationWindow?.closeTime}
                        canRegister={
                            !isLoading &&
                            (target.status === "available" || target.status === "cancelled")
                        }
                        canCancelToday={
                            !isLoading &&
                            (target.status === "confirmed" ||
                                (target.status === "pending" && target.requestType === "register"))
                        }
                        canRegisterGuest={
                            !isLoading &&
                            Boolean(target.mealId) &&
                            target.status !== "kitchen_cancelled" &&
                            target.status !== "not_scheduled" &&
                            target.status !== "pending"
                        }
                        currentGuestCount={target.guestCount ?? 0}
                        isBusy={isBusy}
                        onRegisterToday={handleRegisterTarget}
                        onCancelToday={handleCancelTarget}
                        onCancelPermanent={handleCancelPermanent}
                        onCancelCustomRange={handleCancelCustomRange}
                        onRegisterGuest={handleRegisterGuest}
                    />
                </div>
                <div className="col-span-12 space-y-6 rounded-xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
                    {isLoading ? (
                        <div className="rounded-2xl border border-amber-100 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
                            Đang tải lịch ăn...
                        </div>
                    ) : (
                        <MealCalendar
                            month={month}
                            year={year}
                            days={calendarDays}
                            onDayClick={handleDayClick}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

export default MealRegistration;
