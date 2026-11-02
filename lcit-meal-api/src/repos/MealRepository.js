const pool = require("../config/database");
const Meal = require("../models/Meal");
const { SETTING_KEY } = require("../constants/SystemSetting");
const PaginationHelper = require("../ultis/PaginationHelper");

const MEAL_SELECT_FIELDS = `
    id,
  DATE_FORMAT(meal_date, '%Y-%m-%d') AS meal_date,
    is_cancelled,
    cancelled_by,
    note,
    status,
    created_at
`;

// Giờ hoàn thành suất ăn mặc định khi chưa cấu hình `meal_completion_time`
// trong system_setting (khớp DEFAULT_COMPLETION_TIME của jobs/mealCompletionJob.js).
const DEFAULT_COMPLETION_TIME = "12:00";

const getVietnamDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

const getVietnamTimeHHmm = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

// Biểu thức SQL tính "completion_status" (xem constants/MealCompletionStatus.js)
// cho từng bếp ăn ngay trong câu SELECT, dựa trên:
//   - meal_date so với hôm nay (giờ VN)
//   - giờ hiện tại (giờ VN) so với `system_setting.meal_completion_time`
//     (subquery, mặc định "12:00" nếu chưa cấu hình - COALESCE)
//
// LƯU Ý: 5 dấu `?` trong biểu thức này PHẢI được truyền params tương ứng
// (xem getCompletionStatusParams()) và nối vào ĐẦU mảng params, vì chúng
// xuất hiện trong SELECT - tức đứng TRƯỚC mọi điều kiện WHERE khác trong
// câu SQL cuối cùng.
const COMPLETION_STATUS_SQL = `
    CASE
      WHEN meal_date < ? THEN 'completed'
      WHEN meal_date = ?
        AND ? >= COALESCE(
          (SELECT setting_value FROM system_setting
            WHERE setting_key = '${SETTING_KEY.MEAL_COMPLETION_TIME}' LIMIT 1),
          ?
        )
        THEN 'completed'
      WHEN meal_date = ? THEN 'serving'
      ELSE 'pending'
    END AS completion_status
`;

const getCompletionStatusParams = () => {
  const today = getVietnamDate();
  const nowHHmm = getVietnamTimeHHmm();
  return [today, today, nowHHmm, DEFAULT_COMPLETION_TIME, today];
};

class MealRepository {
  async filterGuestCounts(fromDate, toDate) {
    const [rows] = await pool.query(`SELECT g.meal_id, g.facility_id, g.guest_count, DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date
      FROM meal_guest_count g JOIN meal m ON m.id=g.meal_id
      WHERE m.is_cancelled=0 AND m.status='active' AND m.meal_date BETWEEN ? AND ? ORDER BY m.meal_date`, [fromDate || '2000-01-01', toDate || '9999-12-31']);
    return rows.map(row => ({ mealId: row.meal_id, facilityId: row.facility_id, guestCount: row.guest_count, mealDate: row.meal_date }));
  }

  async addGuestCount(mealId, facilityId, count, actorId) {
    const [result] = await pool.query(`INSERT INTO meal_guest_count(meal_id,facility_id,guest_count,updated_by)
      SELECT id,?,?,? FROM meal WHERE id=? AND is_cancelled=0 AND status='active'
      ON DUPLICATE KEY UPDATE guest_count=meal_guest_count.guest_count+VALUES(guest_count), updated_by=VALUES(updated_by), updated_at=NOW()`,
    [facilityId, count, actorId || null, mealId]);
    if (!result.affectedRows) return null;
    const [[row]] = await pool.query('SELECT meal_id,facility_id,guest_count FROM meal_guest_count WHERE meal_id=? AND facility_id=?', [mealId, facilityId]);
    return { mealId: row.meal_id, facilityId: row.facility_id, guestCount: row.guest_count };
  }

  async list() {
    const [rows] = await pool.query(`
      SELECT ${MEAL_SELECT_FIELDS}
      FROM meal
      ORDER BY meal_date DESC
    `);

    return rows.map((row) => new Meal(row));
  }

  async get(id) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_SELECT_FIELDS}
      FROM meal
      WHERE id = ?
      LIMIT 1
    `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new Meal(rows[0]);
  }

  // Lấy meal theo ID kèm completion_status (để kiểm tra thời gian)
  async getWithCompletionStatus(id) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_SELECT_FIELDS},
        ${COMPLETION_STATUS_SQL}
      FROM meal
      WHERE id = ?
      LIMIT 1
    `,
      [...getCompletionStatusParams(), id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new Meal(rows[0]);
  }

  // Mỗi ngày chỉ có duy nhất 1 bếp ăn (uq_meal_date)
  async getByDate(mealDate) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_SELECT_FIELDS},
        ${COMPLETION_STATUS_SQL}
      FROM meal
      WHERE meal_date = ?
      LIMIT 1
    `,
      [...getCompletionStatusParams(), mealDate],
    );

    if (rows.length === 0) {
      return null;
    }

    return new Meal(rows[0]);
  }

  async filter(fromDate, toDate, status, isCancelled) {
    let sql = `
      SELECT ${MEAL_SELECT_FIELDS},
        ${COMPLETION_STATUS_SQL}
      FROM meal
      WHERE 1 = 1
    `;

    const params = [...getCompletionStatusParams()];

    if (fromDate) {
      sql += ` AND meal_date >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND meal_date <= ? `;
      params.push(toDate);
    }

    if (status) {
      sql += ` AND status = ? `;
      params.push(status);
    }

    if (
      isCancelled !== undefined &&
      isCancelled !== null &&
      isCancelled !== ""
    ) {
      sql += ` AND is_cancelled = ? `;
      params.push(isCancelled ? 1 : 0);
    }

    sql += ` ORDER BY meal_date DESC `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => new Meal(row));
  }

  // Lọc dữ liệu kèm phân trang
  async filterPaginated(
    fromDate,
    toDate,
    status,
    isCancelled,
    page = 1,
    limit = 10
  ) {
    const { limit: validLimit, offset } =
      PaginationHelper.parsePagination(page, limit);

    let sql = `
      SELECT ${MEAL_SELECT_FIELDS},
        ${COMPLETION_STATUS_SQL}
      FROM meal
      WHERE 1 = 1
    `;

    const params = [...getCompletionStatusParams()];

    if (fromDate) {
      sql += ` AND meal_date >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND meal_date <= ? `;
      params.push(toDate);
    }

    if (status) {
      sql += ` AND status = ? `;
      params.push(status);
    }

    if (
      isCancelled !== undefined &&
      isCancelled !== null &&
      isCancelled !== ""
    ) {
      sql += ` AND is_cancelled = ? `;
      params.push(isCancelled ? 1 : 0);
    }

    // Count total
    const countSql = sql.replace(
      `SELECT ${MEAL_SELECT_FIELDS}, ${COMPLETION_STATUS_SQL}`,
      "SELECT COUNT(*) as total"
    );
    const [[{ total }]] = await pool.query(countSql, params);

    // Get paginated data
    sql += ` ORDER BY meal_date DESC `;
    sql = PaginationHelper.appendPaginationSQL(sql, validLimit, offset);
    const paginationParams = PaginationHelper.appendPaginationParams(
      params,
      validLimit,
      offset
    );

    const [rows] = await pool.query(sql, paginationParams);

    return {
      data: rows.map((row) => new Meal(row)),
      pagination: PaginationHelper.createMeta(page, validLimit, total),
    };
  }

  async create(data) {
    const [result] = await pool.query(
      `
            INSERT INTO meal (meal_date, is_cancelled, cancelled_by, note, status, created_at)
            VALUES (?, 0, NULL, ?, ?, NOW())
        `,
      [data.mealDate, data.note || null, data.status || "active"],
    );

    return this.get(result.insertId);
  }

  async update(id, data) {
    const [result] = await pool.query(
      `
            UPDATE meal
            SET
                meal_date = ?,
                note = ?,
                status = ?
            WHERE id = ?
        `,
      [data.mealDate, data.note, data.status || "active", id],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.get(id);
  }

  // Hủy bếp ăn của 1 ngày (không xóa, chỉ đánh dấu is_cancelled)
  async cancel(id, cancelledBy, note) {
    await pool.query(
      `
            UPDATE meal
            SET
                is_cancelled = 1,
                cancelled_by = ?,
                note = COALESCE(?, note)
            WHERE id = ?
        `,
      [cancelledBy, note || null, id],
    );

    return this.get(id);
  }

  // Mở lại bếp ăn đã hủy nhầm
  async restore(id) {
    await pool.query(
      `
            UPDATE meal
            SET
                is_cancelled = 0,
                cancelled_by = NULL
            WHERE id = ?
        `,
      [id],
    );

    return this.get(id);
  }

  async delete(id) {
    const [result] = await pool.query(
      `
            DELETE FROM meal
            WHERE id = ?
        `,
      [id],
    );

    return result.affectedRows > 0;
  }

  // Danh sách id user đã đăng ký (pending/confirmed) suất ăn của 1 ngày -> dùng để báo hủy bếp ăn
  async getRegisteredUserIds(mealId) {
    const [rows] = await pool.query(
      `
            SELECT DISTINCT user_id
            FROM meal_registration
            WHERE meal_id = ?
                AND status IN ('pending', 'confirmed')
        `,
      [mealId],
    );

    return rows.map((row) => row.user_id);
  }

  // Tổng hợp số suất ăn cần chuẩn bị cho 1 ngày (dùng cho bếp)
  // JOIN với bảng trung gian meal_registration
  async getSummary(mealId) {
    const [rows] = await pool.query(
      `
            SELECT
                m.id,
                m.meal_date,
                m.is_cancelled,
                m.cancelled_by,
                m.note,
                m.status,
                m.created_at,
                COALESCE(SUM(CASE WHEN mr.status IN ('confirmed','completed') THEN 1 ELSE 0 END), 0) AS registered_count,
                COALESCE(SUM(CASE WHEN mr.status IN ('confirmed','completed') THEN mr.guest_count ELSE 0 END), 0) AS guest_count_total
            FROM meal m
            LEFT JOIN meal_registration mr ON mr.meal_id = m.id
            WHERE m.id = ?
            GROUP BY m.id
        `,
      [mealId],
    );

    if (rows.length === 0) {
      return null;
    }

    const extra = await this.filterGuestCounts(rows[0].meal_date, rows[0].meal_date);
    rows[0].guest_count_total = Number(rows[0].guest_count_total) + extra.reduce((sum, item) => sum + Number(item.guestCount), 0);
    return new Meal(rows[0]);
  }
}

module.exports = MealRepository;
