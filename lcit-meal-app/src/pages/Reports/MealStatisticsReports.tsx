import React, { useEffect, useState } from "react";
import { useNotification } from "@/hooks/useNotification";
import { usePagination } from "@/hooks/usePagination";
import {
    mealService,
    settingsService,
    ApiError,
    type MealRegistration,
} from "@/api";
import Pagination from "@/components/common/Pagination";
import { inputClass, panelClass } from "../shared/adminUiStyles";
import { PageTitle } from "../shared/AdminUI";
import PageMeta from "@/components/common/PageMeta";
import { pageMeta } from "../PageMeta";
import { mdiDownload, mdiRefresh, mdiTrendingUp } from "@mdi/js";
import { Icon } from "@mdi/react";

const pad2 = (n: number) => String(n).padStart(2, "0");

type StatisticsPeriod = "month" | "quarter" | "year";

interface MealStats {
    totalMeals: number;
    totalRegistrations: number;
    totalCancellations: number;
    totalGuests: number;
    registrationRate: number; // percentage
    cancellationRate: number; // percentage
    guestAverage: number;
}

interface DailyStats {
    date: string;
    registrations: number;
    cancellations: number;
    guests: number;
}

const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
};

const StatCard: React.FC<{
    title: string;
    value: string | number;
    unit?: string;
    icon?: string;
    variant?: "primary" | "success" | "danger" | "warning";
}> = ({ title, value, unit, icon, variant = "primary" }) => {
    const variantClasses = {
        primary: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100",
        success: "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
        danger: "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100",
        warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100",
    };

    return (
        <div className={`rounded-lg border p-4 ${variantClasses[variant]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-75">{title}</p>
                    <p className="mt-2 flex items-baseline gap-1 text-2xl font-semibold">
                        <span>{value}</span>
                        {unit && <span className="text-sm opacity-75">{unit}</span>}
                    </p>
                </div>
                {icon && (
                    <Icon path={icon} size={1.5} />
                )}
            </div>
        </div>
    );
};

const MealStatisticsReports: React.FC = () => {
    const { showNotification } = useNotification();
    const now = new Date();

    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [period, setPeriod] = useState<StatisticsPeriod>("month");

    const [, setMeals] = useState<any[]>([]);
    const [registrations, setRegistrations] = useState<MealRegistration[]>([]);
    const [stats, setStats] = useState<MealStats | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mealPrice, setMealPrice] = useState("0");

    const pagination = usePagination({ initialPage: 1, initialLimit: 20 });

    const getDateRange = () => {
        let from: string, to: string;

        if (period === "month") {
            from = `${year}-${pad2(month)}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
        } else if (period === "quarter") {
            const quarter = Math.floor((month - 1) / 3) + 1;
            const startMonth = (quarter - 1) * 3 + 1;
            from = `${year}-${pad2(startMonth)}-01`;
            const endMonth = startMonth + 2;
            const lastDay = new Date(year, endMonth + 1, 0).getDate();
            to = `${year}-${pad2(endMonth)}-${pad2(lastDay)}`;
        } else {
            // year
            from = `${year}-01-01`;
            to = `${year}-12-31`;
        }

        return { from, to };
    };

    const calculateStats = (mealsData: any[], registrationsData: MealRegistration[]) => {
        const totalMeals = mealsData.filter(m => !m.isCancelled).length;
        const totalRegistrations = registrationsData.filter(r =>
            r.status === "confirmed" || r.status === "completed"
        ).length;
        const totalCancellations = registrationsData.filter(r => r.status === "cancelled").length;
        const totalGuests = registrationsData
            .filter(r => r.status === "confirmed" || r.status === "completed")
            .reduce((sum, r) => sum + (r.guestCount || 0), 0);

        const registrationRate = totalMeals > 0 ? (totalRegistrations / totalMeals) * 100 : 0;
        const cancellationRate = totalRegistrations > 0 ? (totalCancellations / (totalCancellations + totalRegistrations)) * 100 : 0;
        const guestAverage = totalRegistrations > 0 ? totalGuests / totalRegistrations : 0;

        setStats({
            totalMeals,
            totalRegistrations,
            totalCancellations,
            totalGuests,
            registrationRate,
            cancellationRate,
            guestAverage,
        });

        // Tính toán stats theo ngày
        const dailyMap = new Map<string, DailyStats>();
        mealsData.forEach(meal => {
            const mealRegs = registrationsData.filter(r => r.mealId === meal.id);
            const registered = mealRegs.filter(r => r.status === "confirmed" || r.status === "completed").length;
            const cancelled = mealRegs.filter(r => r.status === "cancelled").length;
            const guests = mealRegs
                .filter(r => r.status === "confirmed" || r.status === "completed")
                .reduce((sum, r) => sum + (r.guestCount || 0), 0);

            dailyMap.set(meal.mealDate, {
                date: meal.mealDate,
                registrations: registered,
                cancellations: cancelled,
                guests,
            });
        });

        setDailyStats(Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { from, to } = getDateRange();
            const [mealsData, registrationsData, priceSetting] = await Promise.all([
                mealService.filterMeals({ from, to }),
                mealService.filterRegistrations({ from, to }),
                settingsService.getByKey("meal_price").catch(() => null),
            ]);

            setMeals(mealsData);
            setRegistrations(registrationsData);
            calculateStats(mealsData, registrationsData);
            if (priceSetting) setMealPrice(priceSetting.setting_value);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu thống kê",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month, period]);

    const handleExport = async () => {
        if (registrations.length === 0) {
            showNotification("Không có dữ liệu để xuất", "warning");
            return;
        }

        try {
            const { from, to } = getDateRange();
            await mealService.exportRegistrations({
                from,
                to,
                status: "confirmed",
            });
            showNotification("Xuất dữ liệu thành công", "success");
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi xuất dữ liệu",
                "error",
            );
        }
    };

    const getPeriodLabel = () => {
        if (period === "month") return `Tháng ${pad2(month)}/${year}`;
        if (period === "quarter") {
            const quarter = Math.floor((month - 1) / 3) + 1;
            return `Quý ${quarter}/${year}`;
        }
        return `Năm ${year}`;
    };

    return (
        <>
            <PageMeta
                title="Báo cáo thống kê suất ăn"
                description={pageMeta.reports.description}
            />
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <PageTitle title="Báo cáo thống kê suất ăn" />
                </div>

                {/* Bộ lọc và điều khiển */}
                <div className={panelClass}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Năm
                            </label>
                            <input
                                type="number"
                                min="2020"
                                max={new Date().getFullYear() + 1}
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Tháng
                            </label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className={inputClass}
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>
                                        Tháng {pad2(m)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Khoảng thời gian
                            </label>
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value as StatisticsPeriod)}
                                className={inputClass}
                            >
                                <option value="month">Theo tháng</option>
                                <option value="quarter">Theo quý</option>
                                <option value="year">Theo năm</option>
                            </select>
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                onClick={loadData}
                                disabled={isLoading}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Icon path={mdiRefresh} size={0.8} />
                                Tải lại
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={isLoading || registrations.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                                <Icon path={mdiDownload} size={0.8} />
                                Xuất Excel
                            </button>
                        </div>
                    </div>
                </div>

                {/* Thống kê chính */}
                {isLoading ? (
                    <div className="text-center text-gray-500">Đang tải dữ liệu...</div>
                ) : stats ? (
                    <>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {getPeriodLabel()}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                title="Tổng số bếp ăn"
                                value={stats.totalMeals}
                                unit="ngày"
                                variant="primary"
                                icon={mdiTrendingUp}
                            />
                            <StatCard
                                title="Tổng đăng ký"
                                value={stats.totalRegistrations}
                                unit="suất"
                                variant="success"
                            />
                            <StatCard
                                title="Tổng cắt suất"
                                value={stats.totalCancellations}
                                unit="suất"
                                variant="danger"
                            />
                            <StatCard
                                title="Tổng khách"
                                value={stats.totalGuests}
                                unit="suất"
                                variant="warning"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <StatCard
                                title="Tỷ lệ đăng ký"
                                value={stats.registrationRate.toFixed(1)}
                                unit="%"
                                variant="success"
                            />
                            <StatCard
                                title="Tỷ lệ cắt suất"
                                value={stats.cancellationRate.toFixed(1)}
                                unit="%"
                                variant="danger"
                            />
                            <StatCard
                                title="Trung bình khách/suất"
                                value={stats.guestAverage.toFixed(2)}
                                unit="người"
                                variant="primary"
                            />
                        </div>

                        {/* Bảng chi tiết ngày */}
                        <div className={panelClass}>
                            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">
                                Chi tiết theo ngày ({dailyStats.length} bản ghi)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-gray-200 dark:border-gray-700">
                                        <tr className="text-gray-600 dark:text-gray-400">
                                            <th className="px-4 py-3 text-left font-medium">Ngày</th>
                                            <th className="px-4 py-3 text-right font-medium">Đăng ký</th>
                                            <th className="px-4 py-3 text-right font-medium">Cắt suất</th>
                                            <th className="px-4 py-3 text-right font-medium">Khách</th>
                                            <th className="px-4 py-3 text-right font-medium">Tổng</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {dailyStats
                                            .slice(
                                                (pagination.page - 1) * pagination.limit,
                                                pagination.page * pagination.limit
                                            )
                                            .map((day) => (
                                                <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                        {formatDate(day.date)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                                                        {day.registrations}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                                                        {day.cancellations}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                                                        {day.guests}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                        {day.registrations + day.guests}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Phân trang */}
                            {dailyStats.length > pagination.limit && (
                                <Pagination
                                    pagination={{
                                        page: pagination.page,
                                        limit: pagination.limit,
                                        total: dailyStats.length,
                                        totalPages: Math.ceil(dailyStats.length / pagination.limit),
                                        hasNextPage: pagination.page < Math.ceil(dailyStats.length / pagination.limit),
                                        hasPreviousPage: pagination.page > 1,
                                    }}
                                    onPageChange={pagination.setPage}
                                    onLimitChange={pagination.setLimit}
                                    loading={isLoading}
                                />
                            )}
                        </div>

                        {/* Thông tin giá */}
                        {mealPrice && (
                            <div className={panelClass}>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Giá suất ăn:</span> {Number(mealPrice).toLocaleString('vi-VN')} ₫
                                </p>
                                {stats.totalRegistrations > 0 && (
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Doanh thu dự kiến:</span>{" "}
                                        {(stats.totalRegistrations * Number(mealPrice)).toLocaleString('vi-VN')} ₫
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </>
    );
};

export default MealStatisticsReports;
