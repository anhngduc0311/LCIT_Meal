import { useMemo } from "react";
import MdiIcon from "@/components/common/MdiIcon";
import { mdiCalendarMonthOutline } from "@mdi/js";

// Trạng thái thực tế của 1 ngày, tổng hợp từ `meal` + `meal_registration`
// (+ `meal_option` với chế độ quản lý) của backend:
//   not_scheduled     - chưa có bếp ăn cho ngày này (chưa tạo lịch)
//   kitchen_cancelled - bếp ăn ngày này đã bị hủy (meal.is_cancelled = 1)
//   completed         - đã đăng ký và suất ăn đã THỰC SỰ diễn ra (ngày đã
//                       qua, cronjob hoàn thành suất ăn đã chuyển
//                       confirmed -> completed - xem mealCompletionJob.js)
//   confirmed         - đã đăng ký và được xác nhận, CHƯA tới giờ ăn
//   pending           - đang có yêu cầu chờ quản lý/admin duyệt (đăng ký hoặc
//                       cắt suất SAU giờ chốt đăng ký) - xem `requestType`
//   cancelled         - đã hủy đăng ký / có yêu cầu cắt suất được duyệt /
//                       nằm trong 1 sự kiện "Hủy lịch" (nghỉ lễ/Tết)
//   available         - có bếp ăn, chưa đăng ký, có thể đăng ký
export type DayStatus =
  | "not_scheduled"
  | "kitchen_cancelled"
  | "completed"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "available";

export type MealDay = {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  mealId?: number;
  registrationId?: number;
  guestCount?: number;
  // Chỉ có khi status = "pending": đang xin đăng ký hay xin cắt suất.
  requestType?: "register" | "cancel";
};

type Props = {
  month: number; // 1-12
  year: number;
  days: MealDay[];
  onDayClick?: (day: MealDay) => void;
};

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const toMondayIndex = (jsDay: number) => (jsDay + 6) % 7;

const formatDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const STATUS_LABEL: Record<DayStatus, string> = {
  // Ngày chưa tạo lịch (chưa có bản ghi `meal`) hiển thị chung nhóm "Chưa
  // đăng ký" như ngày đã có lịch nhưng chưa đăng ký - đơn giản hóa cách
  // hiểu cho nhân viên (không cần phân biệt "chưa tạo lịch" và "chưa đăng
  // ký" từ góc nhìn người dùng).
  not_scheduled: "Chưa đăng ký",
  kitchen_cancelled: "Bếp nghỉ",
  completed: "Đã hoàn thành",
  confirmed: "Đã đăng ký",
  pending: "Chờ duyệt",
  cancelled: "Đã hủy",
  available: "Chưa đăng ký",
};

const getStatusLabel = (day: MealDay) => {
  if (day.status === "pending") {
    if (day.requestType === "cancel") return "Chờ duyệt cắt suất";
    if (day.requestType === "register") return "Chờ duyệt đăng ký";
  }
  return STATUS_LABEL[day.status];
};

const STATUS_CLASS: Record<DayStatus, string> = {
  not_scheduled:
    "border-dashed border-gray-200 bg-white dark:border-gray-700 dark:bg-white/[0.02]",
  kitchen_cancelled:
    "border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-white/[0.04]",
  completed:
    "border-teal-100 bg-teal-50/40 dark:border-teal-900/40 dark:bg-teal-500/5",
  confirmed:
    "border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-500/5",
  pending:
    "border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-500/5",
  cancelled:
    "border-red-100 bg-red-50/40 dark:border-red-900/40 dark:bg-red-500/5",
  available: "border-amber-100 bg-amber-50/30 dark:border-amber-900/30",
};

const STATUS_BADGE_CLASS: Record<DayStatus, string> = {
  not_scheduled: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
  kitchen_cancelled:
    "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  completed:
    "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  confirmed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  available:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

const MealCalendar: React.FC<Props> = ({ month, year, days, onDayClick }) => {
  const activeCount = useMemo(
    () =>
      days.filter(
        (d) =>
          d.status === "confirmed" ||
          (d.status === "pending" && d.requestType === "cancel") ||
          d.status === "completed",
      ).length,
    [days],
  );

  const { leadingDates, trailingDates } = useMemo(() => {
    if (days.length === 0) {
      return { leadingDates: [] as Date[], trailingDates: [] as Date[] };
    }

    const firstDate = new Date(days[0].date);
    const lastDate = new Date(days[days.length - 1].date);

    const leadingCount = toMondayIndex(firstDate.getDay());
    const leading: Date[] = [];
    for (let i = leadingCount; i >= 1; i--) {
      const d = new Date(firstDate);
      d.setDate(d.getDate() - i);
      leading.push(d);
    }

    const totalCells = leadingCount + days.length;
    const trailingCount = (7 - (totalCells % 7)) % 7;
    const trailing: Date[] = [];
    for (let i = 1; i <= trailingCount; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      trailing.push(d);
    }

    return { leadingDates: leading, trailingDates: trailing };
  }, [days]);

  const renderOutsideCard = (date: Date, key: string) => {
    const weekdayLabel = WEEKDAY_LABELS[toMondayIndex(date.getDay())];
    return (
      <div
        key={key}
        aria-disabled="true"
        className="cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 p-4 opacity-60 dark:border-gray-800 dark:bg-white/[0.02]"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-300 dark:text-gray-600">
            {weekdayLabel}
          </span>
          <span className="text-xs text-gray-300 dark:text-gray-600">
            {formatDate(date)}
          </span>
        </div>
        <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-300 dark:bg-white/5 dark:text-gray-600">
          Ngoài tháng
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10">
            <MdiIcon path={mdiCalendarMonthOutline} size={0.9} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              Lịch ăn tháng {String(month).padStart(2, "0")}/{year}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeCount} ngày đã đăng ký / {days.length} ngày trong tháng
            </p>
          </div>
        </div>
      </div>

      {/* Header thứ trong tuần, bắt đầu từ T2 */}
      <div className="mb-2 hidden grid-cols-7 gap-4 lg:grid">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid các thẻ ngày */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {leadingDates.map((d, i) => renderOutsideCard(d, `leading-${i}`))}

        {days.map((day) => {
          const date = new Date(day.date);
          const weekdayLabel = WEEKDAY_LABELS[toMondayIndex(date.getDay())];
          const clickable =
            Boolean(onDayClick) &&
            (day.status === "available" ||
              day.status === "confirmed" ||
              day.status === "pending" ||
              day.status === "cancelled");

          return (
            <button
              type="button"
              key={day.date}
              disabled={!clickable}
              onClick={() => clickable && onDayClick?.(day)}
              className={`rounded-xl border p-4 text-left transition ${STATUS_CLASS[day.status]} ${
                clickable
                  ? "cursor-pointer hover:ring-2 hover:ring-brand-300"
                  : "cursor-default"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-white">
                  {weekdayLabel}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(date)}
                </span>
              </div>

              <span
                className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[day.status]}`}
              >
                {getStatusLabel(day)}
                {(day.status === "confirmed" ||
                  day.status === "completed" ||
                  day.status === "pending") &&
                day.guestCount
                  ? ` (+${day.guestCount} khách)`
                  : ""}
              </span>
            </button>
          );
        })}

        {trailingDates.map((d, i) => renderOutsideCard(d, `trailing-${i}`))}
      </div>
    </div>
  );
};

export default MealCalendar;
