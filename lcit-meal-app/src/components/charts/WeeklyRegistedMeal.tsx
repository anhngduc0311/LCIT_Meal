import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import type { WeeklyChartPoint, DashboardChartPeriod } from "@/api";

type Props = {
  data: WeeklyChartPoint[];
  period: DashboardChartPeriod;
  onPeriodChange: (period: DashboardChartPeriod) => void;
  loading?: boolean;
  // Tiêu đề tùy chỉnh (vd số liệu cá nhân); mặc định theo `period`.
  title?: string;
};

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_LABELS = [
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "T10",
  "T11",
  "T12",
];

const PERIOD_OPTIONS: { value: DashboardChartPeriod; label: string }[] = [
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

const PERIOD_TITLE: Record<DashboardChartPeriod, string> = {
  week: "Số lượng suất ăn đăng ký (tuần này)",
  month: "Số lượng suất ăn đăng ký (tháng này)",
  year: "Số lượng suất ăn đăng ký (năm nay)",
};

// data[i].meal_date là "YYYY-MM-DD" khi filter tuần/tháng, hoặc "YYYY-MM"
// khi filter năm (mỗi điểm là 1 tháng, xem DashboardRepository.getChartByPeriod)
const formatLabel = (dateStr: string, period: DashboardChartPeriod) => {
  if (period === "year") {
    const month = Number(dateStr.slice(5, 7));
    return MONTH_LABELS[month - 1] ?? dateStr;
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${WEEKDAY_LABELS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
};

export default function WeeklyRegistedMeal({
  data,
  period,
  onPeriodChange,
  loading,
  title,
}: Props) {
  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: data.map((item) => formatLabel(item.meal_date, period)),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },

    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val}`,
      },
    },
  };
  const series = [
    {
      name: "Suất ăn đăng ký",
      data: data.map((item) => Number(item.total_meal_slots ?? 0)),
    },
  ];
  return (
    <div className="overflow-hidden h-139 rounded-2xl border border-gray-300 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {title ?? PERIOD_TITLE[period]}
        </h3>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-white/5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={loading}
              onClick={() => onPeriodChange(option.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${period === option.value
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-162.5 xl:min-w-full pl-2">
          <Chart options={options} series={series} type="bar" height={480} />
        </div>
      </div>
    </div>
  );
}
