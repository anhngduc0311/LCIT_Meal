
import { useEffect, useState } from "react";
import MealMetrics from "@/components/meal/MealMetrics";
import PageMeta from "../../components/common/PageMeta";
import WeeklyRegistedMeal from "@/components/charts/WeeklyRegistedMeal";
import { Link } from "react-router";
import {
  dashboardService,
  ApiError,
  type DashboardHomeData,
  type DashboardChartPeriod,
  type WeeklyChartPoint,
} from "@/api";
import { useNotification } from "@/hooks/useNotification";
import { pageMeta } from "../PageMeta";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/constants/roles";

export default function Home() {
  const [data, setData] = useState<DashboardHomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const isManagement = user?.roles.some(role => role.code === ROLES.ADMIN || role.code === ROLES.MANAGER) ?? false;

  // Biểu đồ "Số lượng suất ăn đăng ký" ở trang chủ - lọc riêng theo
  // tuần/tháng/năm, tách khỏi weeklyChart (luôn cố định 7 ngày gần nhất,
  // dùng cho thẻ tổng hợp MealMetrics).
  const [chartPeriod, setChartPeriod] = useState<DashboardChartPeriod>("week");
  const [chartData, setChartData] = useState<WeeklyChartPoint[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const handlePeriodChange = (period: DashboardChartPeriod) => {
    if (period === chartPeriod) return;
    setIsChartLoading(true);
    setChartPeriod(period);
  };

  useEffect(() => {
    let isMounted = true;

    dashboardService
      .getHome(1)
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((error) => {
        showNotification(
          error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu trang chủ",
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    dashboardService
      .getChart(chartPeriod, undefined, undefined, 1)
      .then((result) => {
        if (isMounted) setChartData(result.data);
      })
      .catch((error) => {
        showNotification(
          error instanceof ApiError
            ? error.message
            : "Lỗi khi tải dữ liệu biểu đồ",
          "error",
        );
      })
      .finally(() => {
        if (isMounted) setIsChartLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod]);

  return (
    <>
      <PageMeta
        title={pageMeta.dashboard.title}
        description={pageMeta.dashboard.description}
      />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isManagement ? "Điều hành bếp · Cơ sở 1" : "Suất ăn cơ sở 1"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isManagement ? "Theo dõi suất cần chuẩn bị, xử lý yêu cầu và xem báo cáo của bếp." : "Cán bộ và khách mời tại cơ sở 1, đồng nhất với ứng dụng LCIT Meal."}
        </p>
      </div>
      {isLoading ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Đang tải dữ liệu trang chủ...
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12 space-y-6">
            <MealMetrics
              todayMeal={data?.todayMeal ?? null}
              todayStaff={data?.todayStaff ?? null}
              weeklyChart={data?.weeklyChart ?? []}
            />
          </div>
          {isManagement && <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { path: "/meal-schedule", title: "Quản lý lịch ăn", detail: "Xem đăng ký, cắt suất và điều chỉnh suất khách" },
              { path: "/meal-option-management", title: "Yêu cầu chờ duyệt", detail: `${data?.pendingMealOptionCount ?? 0} yêu cầu · Tất cả cơ sở` },
              { path: "/reports", title: "Báo cáo cơ sở 1", detail: "Thống kê tháng, thanh toán và xuất bảng chấm cơm" },
              { path: "/user-management", title: "Danh sách cán bộ", detail: "Tra cứu và quản lý thông tin cán bộ" },
            ].map(action => <Link key={action.path} to={action.path}
              className="rounded-2xl border border-gray-300 bg-white p-5 transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-white/3 dark:hover:bg-white/5">
              <div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-gray-900 dark:text-white">{action.title}</h2><span aria-hidden="true" className="text-brand-500">→</span></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{action.detail}</p>
            </Link>)}
          </div>}
          <div className="col-span-12 space-y-6">
            <div className="col-span-12 lg:col-span-6 space-y-6">
              <WeeklyRegistedMeal
                data={chartData}
                period={chartPeriod}
                title={`Suất ăn cơ sở 1 (${chartPeriod === "week" ? "tuần này" : chartPeriod === "month" ? "tháng này" : "năm nay"})`}
                onPeriodChange={handlePeriodChange}
                loading={isChartLoading}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
