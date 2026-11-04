const pool = require("../config/database");
const userFacility = require('../ultis/userFacility');

const getVietnamDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

// --- Helper thuần tính toán khoảng ngày cho filter tuần/tháng/năm ---
// Chủ động dùng Date.UTC (không dùng new Date(dateStr) trực tiếp / các hàm
// local-time) để tránh sai lệch do timezone của máy chủ - vì input/output
// ở đây chỉ là chuỗi "YYYY-MM-DD", không có thành phần giờ.
const parseDateParts = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
};

const addDaysUTC = (dateStr, days) => {
  const { y, m, d } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// 0 = Chủ nhật ... 6 = Thứ 7 (giống Date#getDay())
const getWeekdayUTC = (dateStr) => {
  const { y, m, d } = parseDateParts(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Quy đổi period ("week" | "month" | "year") + ngày mốc -> khoảng ngày cần
// truy vấn + độ chi tiết (theo ngày hay theo tháng).
const resolvePeriodRange = (period, anchorDate) => {
  const { y, m } = parseDateParts(anchorDate);

  if (period === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31`, granularity: "month" };
  }

  if (period === "week") {
    const weekday = getWeekdayUTC(anchorDate);
    // Tuần bắt đầu từ Thứ 2 (khớp với nhãn CN/T2.../T7 đang dùng ở FE)
    const diffToMonday = weekday === 0 ? 6 : weekday - 1;
    const start = addDaysUTC(anchorDate, -diffToMonday);
    const end = addDaysUTC(start, 6);
    // Luôn trả về đủ Thứ 2 - Chủ nhật của tuần; những ngày chưa tới (hoặc
    // chưa có ai đăng ký) sẽ ra 0 nhờ LEFT JOIN + COALESCE ở
    // getChartByDayRange(), không cắt bớt các ngày còn lại trong tuần.
    return { start, end, granularity: "day" };
  }

  // Mặc định: "month"
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${anchorDate.slice(0, 7)}-01`,
    end: `${anchorDate.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
    granularity: "day",
  };
};

// Repository này chạy trực tiếp các câu SELECT (KHÔNG dùng stored
// procedure) - đồng nhất với cách các repository khác trong project này
// đang làm, và né được lỗi #1558 "Column count of mysql.proc is wrong"
// hay gặp trên các bản MariaDB đã nâng cấp qua nhiều phiên bản (bảng hệ
// thống mysql.proc bị lệch schema, chặn CREATE PROCEDURE cho tới khi
// chạy mysql_upgrade). Dùng truy vấn thuần thì không phụ thuộc vấn đề đó.
//
// Logic các câu truy vấn tương ứng với file sql/dashboard_home_procedure.sql
// (mục 1, 2, 3, 4, 4b, 4c, 4d) - giữ nguyên để tham khảo/đối chiếu.
const mealRepository = new (require('./MealRepository'))();
async function guestsForDate(date) {
  return (await mealRepository.filterGuestCounts(date, date)).reduce((sum, item) => sum + Number(item.guestCount), 0);
}
async function scopeChartStaff(rows, start, end, facilityId, monthly = false) {
  if (facilityId === undefined) return rows;
  const [registrations] = await pool.query(`SELECT DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date,
    u.full_name, u.facility_id, mr.guest_count FROM meal_registration mr
    JOIN meal m ON m.id=mr.meal_id JOIN user u ON u.id=mr.user_id
    WHERE m.meal_date BETWEEN ? AND ? AND m.status='active' AND m.is_cancelled=0
      AND mr.status='completed'`, [start,end]);
  const totals = new Map();
  for (const record of registrations) {
    if (userFacility(record) !== (facilityId === 'unassigned' ? null : facilityId)) continue;
    const key = monthly ? record.meal_date.slice(0,7) : record.meal_date;
    const point = totals.get(key) || { registered_staff_count: 0, total_meal_slots: 0 };
    point.registered_staff_count++;
    point.total_meal_slots += 1 + Math.max(0,Number(record.guest_count) || 0);
    totals.set(key,point);
  }
  return rows.map(row => ({ ...row, ...(totals.get(row.meal_date) || { registered_staff_count: 0, total_meal_slots: 0 }) }));
}
async function withGuestChart(rows, start, end, monthly = false, facilityId) {
  const [guests, [settings]] = await Promise.all([
    mealRepository.filterGuestCounts(start, end),
    pool.query("SELECT setting_value FROM system_setting WHERE setting_key='meal_completion_time'"),
  ]);
  const today = getVietnamDate();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const completedToday = time >= (settings[0]?.setting_value || '12:00');
  const amounts = new Map();
  for (const guest of guests) {
    if (facilityId !== undefined && guest.facilityId !== facilityId) continue;
    if (guest.mealDate > today || (guest.mealDate === today && !completedToday)) continue;
    const key = monthly ? guest.mealDate.slice(0, 7) : guest.mealDate;
    amounts.set(key, (amounts.get(key) || 0) + Number(guest.guestCount));
  }
  return rows.map(row => ({ ...row, total_meal_slots: Number(row.total_meal_slots) + (amounts.get(row.meal_date) || 0) }));
}
class DashboardRepository {
  // Kitchen staff prepare meals for one site, not the agency-wide total.
  async getKitchenStaff(date, facilityId) {
    const selectedDate = date || getVietnamDate();
    const [rows] = await pool.query(`SELECT u.full_name, u.facility_id, mr.guest_count
      FROM meal_registration mr
      JOIN meal m ON m.id = mr.meal_id
      JOIN user u ON u.id = mr.user_id
      WHERE m.meal_date = ? AND m.status = 'active' AND m.is_cancelled = 0
        AND mr.status IN ('confirmed','completed')`, [selectedDate]);
    const staff = rows.filter(row => userFacility(row) === facilityId);
    const extraGuests = await mealRepository.filterGuestCounts(selectedDate, selectedDate);
    const guests = staff.reduce((sum, row) => sum + Math.max(0, Number(row.guest_count) || 0), 0)
      + extraGuests.filter(row => Number(row.facilityId) === facilityId)
        .reduce((sum, row) => sum + Math.max(0, Number(row.guestCount) || 0), 0);
    return { facility_id: facilityId, registered_staff_count: staff.length,
      total_guest_count: guests, total_meal_slots: staff.length + guests };
  }

  // 1) Suất ăn hôm nay
  async getTodayMeal(date) {
    const today = date || getVietnamDate();
    const [rows] = await pool.query(
      `SELECT
          m.id                                                        AS meal_id,
          DATE_FORMAT(m.meal_date, '%Y-%m-%d')                         AS meal_date,
          m.is_cancelled,
          m.note                                                      AS cancel_note,
          COALESCE(SUM(CASE WHEN m.is_cancelled = 0
                                  AND mr.status IN ('confirmed','completed')
                             THEN 1 + mr.guest_count ELSE 0 END), 0)  AS total_meal_slots,
          (SELECT setting_value FROM system_setting
            WHERE setting_key = 'meal_price')                         AS meal_price,
          (SELECT setting_value FROM system_setting
            WHERE setting_key = 'guest_meal_price')                   AS guest_meal_price
       FROM meal m
       LEFT JOIN meal_registration mr ON mr.meal_id = m.id
       WHERE m.meal_date = ?
       GROUP BY m.id, m.meal_date, m.is_cancelled, m.note`,
      [today],
    );

    if (rows[0]) rows[0].total_meal_slots = Number(rows[0].total_meal_slots) + await guestsForDate(today);
    return rows[0] ?? null;
  }

  // 2) Cán bộ đăng ký hôm nay
  async getTodayStaff(date) {
    const today = date || getVietnamDate();
    const [rows] = await pool.query(
      `SELECT
          COUNT(DISTINCT mr.user_id)               AS registered_staff_count,
          COALESCE(SUM(mr.guest_count), 0)         AS total_guest_count,
          COALESCE(SUM(1 + mr.guest_count), 0)     AS total_meal_slots
       FROM meal_registration mr
       JOIN meal m ON m.id = mr.meal_id
       WHERE m.meal_date = ?
         AND m.status = 'active'
         AND m.is_cancelled = 0
         AND mr.status IN ('confirmed','completed')`,
      [today],
    );

    const guests = await guestsForDate(today);
    if (rows[0]) { rows[0].total_guest_count = Number(rows[0].total_guest_count) + guests; rows[0].total_meal_slots = Number(rows[0].total_meal_slots) + guests; }
    return rows[0] ?? null;
  }

  // 3) Biểu đồ 7 ngày gần nhất
  // Chỉ đếm suất ăn đã "completed" (đã thực sự diễn ra qua giờ ăn trưa - xem
  // jobs/mealCompletionJob.js), KHÔNG đếm "confirmed" (mới chỉ đăng ký,
  // chưa chắc đã ăn). Vì vậy hôm nay trước 12h trưa và các ngày trong tương
  // lai sẽ luôn ra 0 - đúng ý nghĩa "chỉ tính suất ăn đã hoàn thành".
  async getWeeklyChart() {
    const today = getVietnamDate();
    const [rows] = await pool.query(
      `WITH RECURSIVE date_range AS (
          SELECT DATE_SUB(CAST(? AS DATE), INTERVAL 6 DAY) AS d
          UNION ALL
          SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM date_range
           WHERE d < CAST(? AS DATE)
       )
       SELECT
          DATE_FORMAT(dr.d, '%Y-%m-%d')                                AS meal_date,
          COALESCE(m.is_cancelled, 0)                                   AS is_cancelled,
            COALESCE(SUM(CASE WHEN m.status = 'active'
                        AND m.is_cancelled = 0
                        AND mr.status = 'completed'
                             THEN 1 + mr.guest_count ELSE 0 END), 0)    AS total_meal_slots,
            COUNT(DISTINCT CASE WHEN m.status = 'active'
                         AND m.is_cancelled = 0
                         AND mr.status = 'completed'
                               THEN mr.user_id END)                     AS registered_staff_count
       FROM date_range dr
           LEFT JOIN meal m               ON m.meal_date = dr.d
       LEFT JOIN meal_registration mr ON mr.meal_id = m.id
       GROUP BY dr.d, m.is_cancelled
       ORDER BY dr.d`,
      [today, today],
    );

    return withGuestChart(rows, addDaysUTC(today, -6), today);
  }

  // 3b) Biểu đồ theo khoảng ngày tùy ý (dùng cho filter "tuần"/"tháng" -
  // độ chi tiết theo NGÀY). Tái sử dụng cùng logic/cột với getWeeklyChart(),
  // chỉ khác ở chỗ khoảng ngày [startDate, endDate] được truyền vào thay vì
  // luôn cố định 7 ngày gần nhất. Cũng chỉ đếm suất ăn "completed" (xem giải
  // thích ở getWeeklyChart()).
  async getChartByDayRange(startDate, endDate, facilityId) {
    const [rows] = await pool.query(
      `WITH RECURSIVE date_range AS (
          SELECT CAST(? AS DATE) AS d
          UNION ALL
          SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM date_range
           WHERE d < CAST(? AS DATE)
       )
       SELECT
          DATE_FORMAT(dr.d, '%Y-%m-%d')                                AS meal_date,
          COALESCE(m.is_cancelled, 0)                                   AS is_cancelled,
            COALESCE(SUM(CASE WHEN m.status = 'active'
                        AND m.is_cancelled = 0
                        AND mr.status = 'completed'
                             THEN 1 + mr.guest_count ELSE 0 END), 0)    AS total_meal_slots,
            COUNT(DISTINCT CASE WHEN m.status = 'active'
                         AND m.is_cancelled = 0
                         AND mr.status = 'completed'
                               THEN mr.user_id END)                     AS registered_staff_count
       FROM date_range dr
           LEFT JOIN meal m               ON m.meal_date = dr.d
       LEFT JOIN meal_registration mr ON mr.meal_id = m.id
       GROUP BY dr.d, m.is_cancelled
       ORDER BY dr.d`,
      [startDate, endDate],
    );

    return withGuestChart(await scopeChartStaff(rows, startDate, endDate, facilityId), startDate, endDate, false, facilityId);
  }

  // 3c) Biểu đồ theo THÁNG cho cả 1 năm (dùng cho filter "năm") - gộp dữ
  // liệu 12 tháng, tháng nào không có bản ghi `meal` vẫn trả về 0 (không bị
  // thiếu điểm trên biểu đồ). Cũng chỉ đếm suất ăn "completed".
  async getChartByMonthRange(year, facilityId) {
    const [rows] = await pool.query(
      `SELECT
          DATE_FORMAT(m.meal_date, '%Y-%m')                             AS meal_date,
            COALESCE(SUM(CASE WHEN m.status = 'active'
                        AND m.is_cancelled = 0
                        AND mr.status = 'completed'
                             THEN 1 + mr.guest_count ELSE 0 END), 0)    AS total_meal_slots,
            COUNT(DISTINCT CASE WHEN m.status = 'active'
                         AND m.is_cancelled = 0
                         AND mr.status = 'completed'
                               THEN mr.user_id END)                     AS registered_staff_count
       FROM meal m
       LEFT JOIN meal_registration mr ON mr.meal_id = m.id
       WHERE m.meal_date BETWEEN ? AND ?
       GROUP BY DATE_FORMAT(m.meal_date, '%Y-%m')`,
      [`${year}-01-01`, `${year}-12-31`],
    );

    const byMonth = new Map(rows.map((row) => [row.meal_date, row]));

    const filled = Array.from({ length: 12 }, (_, index) => {
      const label = `${year}-${String(index + 1).padStart(2, "0")}`;
      return (
        byMonth.get(label) || {
          meal_date: label,
          is_cancelled: 0,
          total_meal_slots: 0,
          registered_staff_count: 0,
        }
      );
    });
    return withGuestChart(await scopeChartStaff(filled, `${year}-01-01`, `${year}-12-31`, facilityId, true), `${year}-01-01`, `${year}-12-31`, true, facilityId);
  }

  // Điểm vào chung cho filter tuần/tháng/năm ở trang chủ.
  // period: "week" | "month" | "year"; anchorDate: 1 ngày bất kỳ nằm trong
  // khoảng muốn xem (mặc định hôm nay).
  async getChartByPeriod(period, anchorDate, facilityId) {
    const safeAnchor = anchorDate || getVietnamDate();
    const range = resolvePeriodRange(period, safeAnchor);

    const data =
      range.granularity === "month"
        ? await this.getChartByMonthRange(range.start.slice(0, 4), facilityId)
        : await this.getChartByDayRange(range.start, range.end, facilityId);

    return {
      period,
      granularity: range.granularity,
      from: range.start,
      to: range.end,
      data,
    };
  }

  // 4) Tình trạng thanh toán (kỳ gần nhất của user active có payment)
  async getPaymentList() {
    const [rows] = await pool.query(
      `SELECT
          u.id                AS user_id,
          u.full_name,
          u.username,
          DATE_FORMAT(p.payment_date, '%Y-%m-%d')                      AS payment_date,
          p.amount,
          p.paid_amount,
          p.is_paid,
          p.status            AS payment_status
       FROM user u
       JOIN payment p
         ON p.id = (
              SELECT p2.id
              FROM payment p2
              WHERE p2.user_id = u.id
              ORDER BY p2.payment_date DESC, p2.id DESC
              LIMIT 1
            )
       WHERE u.status = '1'
       ORDER BY u.full_name`,
    );

    return rows;
  }

  // 4b) Tổng công nợ hiện tại
  async getOutstanding() {
    const [rows] = await pool.query(
      `SELECT
          COUNT(*)                                                    AS unpaid_record_count,
          COALESCE(SUM(p.amount - COALESCE(p.paid_amount, 0)), 0)     AS total_outstanding_amount
      FROM payment p
       WHERE p.status IN ('unpaid', 'overdue')`,
    );

    return rows[0] ?? null;
  }

  // 4c) Số yêu cầu đột xuất đang chờ duyệt
  async getPendingMealOptionCount() {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS pending_meal_option_count
       FROM meal_option
        WHERE status = 'pending' AND type IN ('cancel_schedule','cancel_permanent')`,
    );

    return rows[0]?.pending_meal_option_count ?? 0;
  }

  // 4d) Số thông báo chưa xem của user hiện tại
  async getUnseenNotificationCount(userId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unseen_notification_count
       FROM notification_recipient nr
       JOIN notification n ON n.id = nr.notification_id
       WHERE nr.user_id = ?
         AND nr.is_seen = 0
         AND n.status = 'active'`,
      [userId],
    );

    return rows[0]?.unseen_notification_count ?? 0;
  }

  // Chạy song song toàn bộ 7 truy vấn trên cho trang chủ.
  async getHomeData(userId, date, facilityId) {
    const [
      todayMeal,
      todayStaff,
      weeklyChart,
      paymentList,
      outstanding,
      pendingMealOptionCount,
      unseenNotificationCount,
    ] = await Promise.all([
      this.getTodayMeal(date),
      facilityId ? this.getKitchenStaff(date, facilityId) : this.getTodayStaff(date),
      this.getWeeklyChart(),
      this.getPaymentList(),
      this.getOutstanding(),
      this.getPendingMealOptionCount(),
      this.getUnseenNotificationCount(userId),
    ]);

    if (facilityId && todayMeal) todayMeal.total_meal_slots = todayStaff.total_meal_slots;
    return {
      todayMeal,
      todayStaff,
      weeklyChart,
      paymentList,
      outstanding,
      pendingMealOptionCount,
      unseenNotificationCount,
    };
  }
}

module.exports = DashboardRepository;
