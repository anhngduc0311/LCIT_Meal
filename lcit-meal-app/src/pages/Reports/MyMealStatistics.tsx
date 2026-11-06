import React, { useEffect, useMemo, useState } from "react";
import PageMeta from "@/components/common/PageMeta";
import WeeklyRegistedMeal from "@/components/charts/WeeklyRegistedMeal";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    dashboardService,
    ApiError,
    type DashboardChartData,
    type DashboardChartPeriod,
} from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import { formatMonthYear } from "@/helper/FormatHelper";
import { panelClass } from "../shared/adminUiStyles";
import { PageTitle } from "../shared/AdminUI";
import { pageMeta } from "../PageMeta";

const WEEKDAY_LABELS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

// "2026-09-30" -> "30/09/2026 (Thứ 4)" ; "2026-09" -> "Tháng 09/2026"
const formatPointLabel = (value: string) => {
    if (value.length === 7) return formatMonthYear(value);
    const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} (${WEEKDAY_LABELS[weekday]})`;
};

const PERIOD_SCOPE: Record<DashboardChartPeriod, string> = {
    week: "tuần này",
    month: "tháng này",
    year: "năm",
};

// Trang "Thống kê suất ăn" của cán bộ: số suất ăn CÁ NHÂN theo tháng (mặc định
// theo năm = từng tháng), cùng dạng biểu đồ với trang chủ nhưng chỉ lấy dữ liệu
// của chính người đăng nhập (gọi API thống kê kèm userId).
const MyMealStatistics: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();

    const currentYear = new Date().getFullYear();
    const [period, setPeriod] = useState<DashboardChartPeriod>("year");
    const [year, setYear] = useState(currentYear);
    const [chart, setChart] = useState<DashboardChartData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let isMounted = true;
        setIsLoading(true);

        // Chọn năm: lấy 1 ngày bất kỳ trong năm đó làm mốc. Tuần/tháng luôn
        // lấy theo hiện tại (backend mặc định hôm nay).
        const anchorDate = period === "year" ? `${year}-06-15` : undefined;

        dashboardService
            .getChart(period, anchorDate, user.id)
            .then((result) => {
                if (isMounted) setChart(result);
            })
            .catch((error) => {
                showNotification(
                    error instanceof ApiError ? error.message : "Lỗi khi tải thống kê suất ăn",
                    "error",
                );
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, year, user?.id]);

    const points = useMemo(() => chart?.data ?? [], [chart]);
    const total = useMemo(
        () => points.reduce((sum, point) => sum + Number(point.total_meal_slots ?? 0), 0),
        [points],
    );
    const activePoints = points.filter((point) => Number(point.total_meal_slots) > 0).length;

    const scopeLabel = period === "year" ? `năm ${year}` : PERIOD_SCOPE[period];

    return (
        <>
            <PageMeta
                title={pageMeta.mealStatistics.title}
                description={pageMeta.mealStatistics.description}
            />
            <div className="p-6">
                <PageTitle title="Thống kê suất ăn của tôi" />

                {period === "year" && (
                    <div className={`${panelClass} mb-5 flex items-center justify-between gap-3 p-3`}>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Năm thống kê
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
                                disabled={isLoading}
                                onClick={() => setYear((value) => value - 1)}
                            >
                                ‹
                            </button>
                            <span className="min-w-14 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                {year}
                            </span>
                            <button
                                type="button"
                                className="h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
                                disabled={isLoading || year >= currentYear}
                                onClick={() => setYear((value) => value + 1)}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                )}

                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                    <div className={`${panelClass} p-5`}>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Tổng số suất ăn ({scopeLabel})
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                            {isLoading ? "..." : total}
                        </p>
                        <p className="mt-2 text-sm text-success-600">
                            Gồm cả khách bạn đăng ký kèm
                        </p>
                    </div>
                    <div className={`${panelClass} p-5`}>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {period === "year" ? "Số tháng có ăn" : "Số ngày có ăn"}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                            {isLoading ? "..." : activePoints}
                        </p>
                        <p className="mt-2 text-sm text-success-600">
                            {period === "year"
                                ? `Trên ${points.length || 12} tháng của năm ${year}`
                                : `Trên ${points.length} ngày của kỳ thống kê`}
                        </p>
                    </div>
                </div>

                <WeeklyRegistedMeal
                    data={points}
                    period={period}
                    onPeriodChange={setPeriod}
                    loading={isLoading}
                    title={`Số suất ăn của tôi (${scopeLabel})`}
                />

                <div className={`${panelClass} mt-5 overflow-hidden`}>
                    <div className={`overflow-x-auto ${period === "year" ? "" : "max-h-120 overflow-y-auto"}`}>
                        <Table>
                            <TableHeader className="sticky top-0 z-10 border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                                <TableRow>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                                    >
                                        {period === "year" ? "Tháng" : "Ngày"}
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                                    >
                                        Số suất ăn
                                    </TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {points.map((point) => (
                                    <TableRow key={point.meal_date}>
                                        <TableCell className="px-5 py-3 text-theme-sm text-gray-800 dark:text-white/90">
                                            {formatPointLabel(point.meal_date)}
                                        </TableCell>
                                        <TableCell className="px-5 py-3 text-end text-theme-sm text-gray-800 dark:text-white/90">
                                            {Number(point.total_meal_slots ?? 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell className="px-5 py-3 text-theme-sm font-semibold text-gray-900 dark:text-white">
                                        Tổng cộng
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-end text-theme-sm font-semibold text-gray-900 dark:text-white">
                                        {total}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Chỉ tính các suất ăn đã hoàn thành (đã ăn), không gồm suất đã cắt hoặc chưa tới giờ ăn.
                </p>
            </div>
        </>
    );
};

export default MyMealStatistics;
