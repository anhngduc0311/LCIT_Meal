import { mdiAccountGroup, mdiChartLine, mdiViewList } from "@mdi/js";
import MealMetricCard from "./MealMetricCard";
import type { TodayMeal, TodayStaff, WeeklyChartPoint } from "@/api";

type Props = {
    todayMeal: TodayMeal;
    todayStaff: TodayStaff;
    weeklyChart: WeeklyChartPoint[];
};

const formatCurrency = (value: string | number | null | undefined) => {
    const num = Number(value ?? 0);
    return `${new Intl.NumberFormat("vi-VN").format(num)}đ`;
};

const MealMetrics = ({ todayMeal, todayStaff, weeklyChart }: Props) => {
    const weeklyTotal = weeklyChart.reduce(
        (sum, day) => sum + Number(day.total_meal_slots ?? 0),
        0,
    );

    const metricItems = [
        {
            icon: mdiViewList,
            title: "Suất ăn hôm nay · Cơ sở 1",
            subtitle: todayMeal
                ? `Đơn giá ${formatCurrency(todayMeal.meal_price)}`
                : "Chưa có dữ liệu bếp ăn hôm nay",
            data: `${todayMeal?.total_meal_slots ?? 0} suất`,
        },
        {
            icon: mdiAccountGroup,
            title: "Cán bộ đăng ký · Cơ sở 1",
            subtitle: `Tổng ${todayStaff?.total_meal_slots ?? 0} suất (${todayStaff?.total_guest_count ?? 0} khách)`,
            data: `${todayStaff?.registered_staff_count ?? 0} người`,
        },
        {
            icon: mdiChartLine,
            title: "7 ngày gần nhất · Cơ sở 1",
            subtitle: "Suất ăn đã hoàn thành trong 7 ngày gần nhất",
            data: `${weeklyTotal} suất`,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
            {metricItems.map((item) => (
                <MealMetricCard
                    key={item.title}
                    title={item.title}
                    subtitle={item.subtitle}
                    data={item.data}
                    icon={item.icon}
                />
            ))}
        </div>
    );
};

export default MealMetrics;
