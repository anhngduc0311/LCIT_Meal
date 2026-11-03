const cron = require("node-cron");
const { canAutoRegister } = require('./autoRegistrationEligibility');

const MealRepository = require("../repos/MealRepository");
const MealRegistrationRepository = require("../repos/MealRegistrationRepository");
const MealOptionRepository = require("../repos/MealOptionRepository");
const UserRepository = require("../repos/UserRepository");
const SystemSettingRepository = require("../repos/SystemSettingRepository");
const HolidayEventRepository = require("../repos/HolidayEventRepository");

const MealScheduleConfigRepository = require("../repos/MealScheduleConfigRepository");

const MEAL_REGISTRATION_STATUS = require("../constants/MealRegistration");
const MEAL_STATUS = require("../constants/Meal");
const { HOLIDAY_EVENT_STATUS } = require("../constants/HolidayEvent");

const CRON_TIMEZONE = "Asia/Ho_Chi_Minh";

const mealRepository = new MealRepository();
const mealRegistrationRepository = new MealRegistrationRepository();
const mealOptionRepository = new MealOptionRepository();
const userRepository = new UserRepository();
const systemSettingRepository = new SystemSettingRepository();
const holidayEventRepository = new HolidayEventRepository();
const mealScheduleConfigRepository = new MealScheduleConfigRepository();

const getVietnamDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CRON_TIMEZONE,
  }).format(new Date());

// Thứ trong tuần (0=CN...6=T7) của 1 ngày "YYYY-MM-DD". Parse trực tiếp
// year/month/day (KHÔNG dùng `new Date(dateStr)`/`new Date(dateStr+"T00:00:00")`)
// để tránh lệch múi giờ máy chủ - `Date.UTC` cho cùng 1 ngày lịch luôn ra
// đúng thứ, bất kể server chạy ở timezone nào.
const getWeekday = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const getMonthRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from(
    { length: lastDay },
    (_, index) =>
      `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
};

// Kiểm tra 1 user có bị 1 yêu cầu meal_option đã DUYỆT (approved), loại
// cancel_permanent/cancel_schedule, che phủ ngày `dateStr` hay không -
// nếu có thì KHÔNG tự động đăng ký cho họ (tôn trọng lựa chọn đã duyệt).
const isCoveredByApprovedOption = (options, userId, dateStr) =>
  options.some(
    (option) =>
      option.userId === userId &&
      option.status === "approved" &&
      (option.type === "cancel_today" ||
        option.type === "cancel_permanent" ||
        option.type === "cancel_schedule") &&
      dateStr >= option.fromDate &&
      dateStr <= option.toDate,
  );

// Tìm sự kiện "hủy lịch" (nghỉ lễ/Tết/sự kiện toàn cơ quan - xem
// services/HolidayEventService.js) đang ở trạng thái ACTIVE và có khoảng
// [fromDate, toDate] che phủ `dateStr`. Trả về event đầu tiên khớp, hoặc
// `undefined` nếu ngày đó không nằm trong sự kiện nào.
const findActiveHolidayEvent = (events, dateStr) =>
  events.find(
    (event) =>
      event.status === HOLIDAY_EVENT_STATUS.ACTIVE &&
      dateStr >= event.fromDate &&
      dateStr <= event.toDate,
  );

/**
 * Tự động chuẩn bị bếp ăn cho 1 tháng (mặc định là tháng hiện tại), cho
 * từng ngày trong tháng:
 *  0. Nếu bật cờ `system_setting.auto_schedule_use_meal_config` (mặc định
 *     bật): kiểm tra thứ trong tuần của ngày đó có nằm trong cấu hình
 *     `meal_schedule_config` (bảng riêng, xem Quản lý > Cấu hình hệ thống
 *     > "Các ngày ăn trong tuần") hay không - đây là các thứ có bố trí
 *     suất ăn (mặc định Thứ 2 - Thứ 6). Nếu KHÔNG (vd: Thứ 7, Chủ Nhật với
 *     cấu hình mặc định): bỏ qua hoàn toàn ngày này, KHÔNG tạo bản ghi
 *     `meal` lẫn đăng ký nào. Nếu tắt cờ này, job tạo bếp ăn cho TẤT CẢ
 *     các ngày trong tháng như hành vi trước khi có tính năng này.
 *  1. Tạo bản ghi `meal` cho ngày đó nếu chưa có.
 *  2. QUERY bảng `holiday_event` để kiểm tra ngày đó có rơi vào 1 sự kiện
 *     "hủy lịch" (nghỉ lễ/Tết/sự kiện toàn cơ quan) đang ACTIVE hay không
 *     - xem services/HolidayEventService.js. Nếu có: tự động hủy `meal`
 *     ngày đó (nếu chưa hủy) và BỎ QUA, không tạo đăng ký nào cho ngày
 *     này - đúng theo cấu hình lịch sự kiện đã có, không phụ thuộc việc
 *     sự kiện được tạo trước hay sau khi job này chạy.
 *  3. Nếu ngày đó KHÔNG rơi vào sự kiện hủy lịch nào và `meal` chưa bị
 *     hủy (có thể bị hủy thủ công bởi quản lý): với mỗi user đang active
 *     mà CHƯA có bản ghi đăng ký (ở bất kỳ trạng thái nào - tôn trọng nếu
 *     họ đã tự đăng ký/tự hủy trước đó) và KHÔNG bị 1 yêu cầu cắt suất đã
 *     duyệt che phủ ngày đó, tự tạo đăng ký "confirmed" cho họ theo cấu
 *     hình (`auto_register_enabled`, `auto_register_start_day`).
 *
 * Chỉ chạy khi cấu hình `auto_register_enabled` (system_setting) = "1".
 *
 * LƯU Ý: cron thật (20:00 hàng ngày, đúng `auto_register_start_day`) luôn
 * chạy cho THÁNG HIỆN TẠI (không truyền `targetMonth`). Muốn chạy thủ công
 * cho 1 tháng cụ thể (vd: test, hoặc admin bấm "Tạo bếp ăn" ở trang lịch
 * ăn), gọi qua `POST /admin-tools/run-auto-schedule?month=YYYY-MM`, ví dụ:
 *   POST /admin-tools/run-auto-schedule?month=2026-09
 * Nếu không truyền `month`, mặc định lấy tháng hiện tại theo giờ VN.
 *
 * @param {string=} targetMonth - "YYYY-MM", mặc định = tháng hiện tại
 * @param {{ fromDate?: string }} options - Giới hạn ngày bắt đầu khi tạo bù.
 */
async function runAutoSchedule(targetMonth, { fromDate } = {}) {
  if (fromDate !== undefined) {
    const parsed = typeof fromDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)
      ? new Date(`${fromDate}T00:00:00Z`) : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fromDate) {
      throw new Error('fromDate must be a valid YYYY-MM-DD date');
    }
  }
  const enabledSetting = await systemSettingRepository
    .getByKey("auto_register_enabled")
    .catch(() => null);

  if (!enabledSetting || enabledSetting.typedValue !== true) {
    console.log("[autoSchedule] auto_register_enabled = false, bỏ qua.");
    return { skipped: true };
  }

  const month = targetMonth || getVietnamDate().slice(0, 7);
  const dates = getMonthRange(month).filter(date => !fromDate || date >= fromDate);
  const [
    users,
    allOptions,
    holidayEvents,
    useMealScheduleConfig,
    enabledScheduleDays,
  ] = await Promise.all([
    userRepository.list(),
    mealOptionRepository.list(),
    holidayEventRepository.list(),
    mealScheduleConfigRepository.getUseMealConfig().catch(() => true),
    mealScheduleConfigRepository.getEnabledDays().catch(() => null),
  ]);

  // Các thứ trong tuần (0=CN...6=T7) có bố trí suất ăn, lấy từ bảng
  // `meal_schedule_config` (mặc định Thứ 2 - Thứ 6). Chỉ áp dụng lọc này
  // khi cờ `auto_schedule_use_meal_config` đang bật VÀ đọc được cấu hình;
  // nếu không, `scheduleDays` = null nghĩa là KHÔNG lọc gì cả (giữ hành vi
  // cũ: tạo bếp ăn cho mọi ngày trong tháng).
  const scheduleDays =
    useMealScheduleConfig && enabledScheduleDays
      ? new Set(enabledScheduleDays)
      : null;

  const activeUsers = users.filter(canAutoRegister);

  let createdMeals = 0;
  let createdRegistrations = 0;
  let skippedHolidayDates = 0;
  let skippedNonScheduleDates = 0;
  for (const date of dates) {
    // Ngày không nằm trong cấu hình "ngày ăn trong tuần" (vd: T7, CN với
    // cấu hình mặc định) - bỏ qua hoàn toàn, không tạo `meal` lẫn đăng ký.
    if (scheduleDays && !scheduleDays.has(getWeekday(date))) {
      skippedNonScheduleDates += 1;
      continue;
    }

    const holidayEvent = findActiveHolidayEvent(holidayEvents, date);

    let meal = await mealRepository.getByDate(date);
    if (!meal) {
      meal = await mealRepository.create({
        mealDate: date,
        note: holidayEvent ? `Nghỉ lịch: ${holidayEvent.name}` : null,
        status: MEAL_STATUS.ACTIVE,
      });
      createdMeals += 1;
    }

    // Ngày rơi vào 1 sự kiện hủy lịch đang active - tự động hủy bếp ăn
    // (nếu chưa hủy) và bỏ qua hoàn toàn, không tạo đăng ký nào cho ngày
    // này, bất kể sự kiện được tạo trước hay sau khi job này chạy.
    if (holidayEvent) {
      if (!meal.isCancelled) {
        meal = await mealRepository.cancel(
          meal.id,
          null,
          `Nghỉ lịch: ${holidayEvent.name}`,
        );
      }
      skippedHolidayDates += 1;
      continue;
    }

    if (meal.isCancelled) continue;

    for (const user of activeUsers) {
      if (isCoveredByApprovedOption(allOptions, user.id, date)) continue;
      const existing = await mealRegistrationRepository.getByUserAndMeal(
        user.id,
        meal.id,
      );
      if (existing) continue;
      await mealRegistrationRepository.create({
        userId: user.id,
        mealId: meal.id,
        guestCount: 0,
        status: MEAL_REGISTRATION_STATUS.CONFIRMED,
      });
      createdRegistrations += 1;
    }
  }

  console.log(
    `[autoSchedule] Tháng ${month}: tạo ${createdMeals} meal, ${createdRegistrations} đăng ký, bỏ qua ${skippedHolidayDates} ngày theo lịch sự kiện, bỏ qua ${skippedNonScheduleDates} ngày không nằm trong lịch ăn trong tuần.`,
  );
  return {
    month,
    createdMeals,
    createdRegistrations,
    skippedHolidayDates,
    skippedNonScheduleDates,
  };
}

// Chạy 20:00 hàng ngày (giờ server) để chuẩn bị bếp ăn + đăng ký cho ngày mai.
function start() {
  const run = (source) => {
    console.log(`[autoSchedule] Bắt đầu chạy (${source}).`);
    return runAutoSchedule().catch((error) => {
      console.error("[autoSchedule] Lỗi khi chạy job tự động:", error);
    });
  };

  cron.schedule(
    "0 20 * * *",
    async () => {
      const today = getVietnamDate();
      const startDay = Number(
        (await systemSettingRepository.getByKey("auto_register_start_day"))
          ?.typedValue || 1,
      );
      if (Number(today.slice(8, 10)) === startDay)
        await run("cron ngày bắt đầu tháng");
    },
    {
      timezone: CRON_TIMEZONE,
      noOverlap: true,
      // Job chỉ chạy 1 lần/ngày lúc 20:00, sai lệch vài chục giây không
      // ảnh hưởng nghiệp vụ - nới dung sai để tránh WARN "missed execution"
      // giả khi event loop bận đúng lúc tick rơi vào (xem giải thích chi
      // tiết trong mealCompletionJob.js).
      missedExecutionTolerance: 30000,
      suppressMissedWarning: true,
    },
  );

  const currentDate = getVietnamDate();
  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: CRON_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  void systemSettingRepository
    .getByKey("auto_register_start_day")
    .then((setting) => {
      const startDay = Number(setting?.typedValue || 1);
      if (currentHour >= 20 && Number(currentDate.slice(8, 10)) === startDay) {
        void run("catch-up sau khi khởi động muộn");
      }
    })
    .catch((error) => {
      console.error(
        "[autoSchedule] Không đọc được ngày bắt đầu tự động:",
        error,
      );
    });

  console.log(
    `[autoSchedule] Đã đăng ký lịch chạy hàng ngày lúc 20:00 (${CRON_TIMEZONE}).`,
  );
}

module.exports = { start, runAutoSchedule };
