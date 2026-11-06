import React, { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import {
    mealService,
    ApiError,
    type Meal,
    type MealRegistration,
} from "@/api";
import { panelClass } from "../shared/adminUiStyles";
import { PageTitle } from "../shared/AdminUI";
import { pageMeta } from "../PageMeta";
import { mdiCheckCircle, mdiCloseCircle, mdiEye } from "@mdi/js";
import { Icon } from "@mdi/react";

const todayISO = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());

const pad2 = (n: number) => String(n).padStart(2, "0");

type ActionType = "view" | "approve" | "reject" | "edit" | "delete" | "edit-user";

interface MealWithRegistrations extends Meal {
    registrations: MealRegistration[];
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    cancelledCount: number;
}

const MealScheduleAdmin: React.FC = () => {
    const { showNotification } = useNotification();
    const confirm = useConfirm();

    const now = new Date();
    const [year] = useState(now.getFullYear());
    const [month] = useState(now.getMonth() + 1);

    const [meals, setMeals] = useState<MealWithRegistrations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMeal, setSelectedMeal] = useState<MealWithRegistrations | null>(null);
    const [selectedRegistration, setSelectedRegistration] = useState<MealRegistration | null>(null);

    const monthRange = useCallback(() => {
        const from = `${year}-${pad2(month)}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
        return { from, to };
    }, [year, month]);

    const loadMeals = useCallback(async () => {
        setIsLoading(true);
        try {
            const { from, to } = monthRange();
            const [mealsData, registrationsData] = await Promise.all([
                mealService.filterMeals({ from, to }),
                mealService.filterRegistrations({ from, to }),
            ]);

            // Nhóm registrations theo meal
            const mealsWithRegs = mealsData.map((meal) => {
                const regs = registrationsData.filter(r => r.mealId === meal.id);
                return {
                    ...meal,
                    registrations: regs,
                    pendingCount: regs.filter(r => r.status === "pending").length,
                    confirmedCount: regs.filter(r => r.status === "confirmed").length,
                    completedCount: regs.filter(r => r.status === "completed").length,
                    cancelledCount: regs.filter(r => r.status === "cancelled").length,
                };
            });

            setMeals(mealsWithRegs);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    }, [monthRange, showNotification]);

    useEffect(() => {
        loadMeals();
    }, [loadMeals]);

    const getMealActionType = (meal: MealWithRegistrations): "view_only" | "can_manage" | "can_edit" => {
        const today = todayISO();

        // Ngày trước hôm nay -> chỉ xem
        if (meal.mealDate < today) {
            return "view_only";
        }

        // Hôm nay -> có thể duyệt cắt, xem chi tiết
        if (meal.mealDate === today) {
            return "can_manage";
        }

        // Ngày sau -> có thể cắt/đăng ký cho người dùng bình thường
        return "can_edit";
    };

    const handleMealClick = (meal: MealWithRegistrations) => {
        setSelectedMeal(meal);
    };

    const handleRegistrationAction = async (
        action: ActionType,
        registration: MealRegistration,
    ) => {
        if (!selectedMeal) return;

        try {
            if (action === "approve") {
                // Nếu registration đang pending -> duyệt
                const ok = await confirm({
                    title: "Duyệt yêu cầu",
                    message: `Bạn có chắc chắn muốn duyệt yêu cầu này?`,
                    confirmText: "Duyệt",
                });
                if (!ok) return;

                await mealService.confirmRegistration(registration.id);
                showNotification("Duyệt thành công", "success");
            } else if (action === "reject") {
                const ok = await confirm({
                    title: "Từ chối yêu cầu",
                    message: `Bạn có chắc chắn muốn từ chối yêu cầu này?`,
                    confirmText: "Từ chối",
                    variant: "danger",
                });
                if (!ok) return;

                await mealService.rejectCancelRequest(registration.id);
                showNotification("Từ chối thành công", "success");
            } else if (action === "delete") {
                const ok = await confirm({
                    title: "Xóa đăng ký",
                    message: `Bạn có chắc chắn muốn xóa đăng ký này?`,
                    confirmText: "Xóa",
                    variant: "danger",
                });
                if (!ok) return;

                await mealService.deleteRegistration(registration.id);
                showNotification("Xóa thành công", "success");
            }

            setSelectedRegistration(null);
            await loadMeals();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Có lỗi xảy ra",
                "error",
            );
        }
    };

    const getMealStatusBadge = (meal: MealWithRegistrations) => {
        if (meal.isCancelled) {
            return <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Bếp đã hủy</span>;
        }

        const actionType = getMealActionType(meal);
        if (actionType === "view_only") {
            return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">Chỉ xem</span>;
        } else if (actionType === "can_manage") {
            return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Hôm nay - Có thể duyệt</span>;
        }
        return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">Có thể chỉnh sửa</span>;
    };

    const formatDate = (date: string) => {
        return new Date(date + "T00:00:00").toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: "Chờ duyệt",
            confirmed: "Đã xác nhận",
            completed: "Đã hoàn thành",
            cancelled: "Đã hủy",
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
            confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
            completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    };

    return (
        <>
            <PageMeta
                title="Quản lý lịch ăn"
                description={pageMeta.dashboard.description}
            />
            <div className="space-y-6">
                <PageTitle title={`Quản lý lịch ăn - Tháng ${pad2(month)}/${year}`} />

                {isLoading ? (
                    <div className="text-center text-gray-500">Đang tải dữ liệu...</div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Danh sách bếp */}
                        <div className={`${panelClass} lg:col-span-1`}>
                            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
                                Lịch bếp ăn
                            </h2>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {meals.map((meal) => (
                                    <button
                                        key={meal.id}
                                        onClick={() => handleMealClick(meal)}
                                        className={`w-full rounded-lg border-2 p-3 text-left transition ${selectedMeal?.id === meal.id
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatDate(meal.mealDate).split(",")[0]}
                                            </div>
                                            {getMealStatusBadge(meal)}
                                        </div>
                                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                            <div>Đăng ký: {meal.confirmedCount + meal.completedCount}</div>
                                            <div>Cắt: {meal.cancelledCount}</div>
                                            {meal.pendingCount > 0 && (
                                                <div className="mt-1 text-amber-600 dark:text-amber-400">
                                                    Chờ duyệt: {meal.pendingCount}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chi tiết bếp */}
                        <div className={`${panelClass} lg:col-span-2`}>
                            {selectedMeal ? (
                                <>
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {formatDate(selectedMeal.mealDate)}
                                                </h2>
                                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                    {getMealActionType(selectedMeal) === "view_only"
                                                        ? "Ngày đã qua - Chỉ xem danh sách"
                                                        : getMealActionType(selectedMeal) === "can_manage"
                                                            ? "Hôm nay - Có thể duyệt yêu cầu cắt"
                                                            : "Ngày sau - Có thể quản lý đăng ký"}
                                                </p>
                                            </div>
                                            {getMealStatusBadge(selectedMeal)}
                                        </div>
                                    </div>

                                    {/* Thống kê */}
                                    <div className="mb-6 grid grid-cols-4 gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                                        <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Chờ duyệt</p>
                                            <p className="mt-1 text-lg font-semibold text-amber-600">{selectedMeal.pendingCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Đã xác nhận</p>
                                            <p className="mt-1 text-lg font-semibold text-green-600">{selectedMeal.confirmedCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Hoàn thành</p>
                                            <p className="mt-1 text-lg font-semibold text-blue-600">{selectedMeal.completedCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Cắt suất</p>
                                            <p className="mt-1 text-lg font-semibold text-red-600">{selectedMeal.cancelledCount}</p>
                                        </div>
                                    </div>

                                    {/* Danh sách đăng ký */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-gray-200 dark:border-gray-700">
                                                <tr className="text-gray-600 dark:text-gray-400">
                                                    <th className="px-4 py-3 text-left font-medium">Cán bộ</th>
                                                    <th className="px-4 py-3 text-center font-medium">Khách</th>
                                                    <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                                                    <th className="px-4 py-3 text-center font-medium">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {selectedMeal.registrations.map((reg) => (
                                                    <tr
                                                        key={reg.id}
                                                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedRegistration?.id === reg.id
                                                                ? "bg-blue-50 dark:bg-blue-900/20"
                                                                : ""
                                                            }`}
                                                        onClick={() => setSelectedRegistration(reg)}
                                                    >
                                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                            Cán bộ #{reg.userId}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                                            {reg.guestCount}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(reg.status)}`}>
                                                                {getStatusLabel(reg.status)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {reg.status === "pending" && getMealActionType(selectedMeal) === "can_manage" ? (
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRegistrationAction("approve", reg);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                                                        title="Duyệt"
                                                                    >
                                                                        <Icon path={mdiCheckCircle} size={0.6} />
                                                                        Duyệt
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRegistrationAction("reject", reg);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                        title="Từ chối"
                                                                    >
                                                                        <Icon path={mdiCloseCircle} size={0.6} />
                                                                        Từ chối
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedRegistration(reg);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                                                >
                                                                    <Icon path={mdiEye} size={0.6} />
                                                                    Xem
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {selectedMeal.registrations.length === 0 && (
                                        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                                            Chưa có đăng ký cho ngày này
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    Chọn một ngày để xem chi tiết
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default MealScheduleAdmin;
