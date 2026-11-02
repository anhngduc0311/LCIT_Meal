const pool = require("../config/database");
const MealRegistration = require("../models/MealRegistration");
const PaginationHelper = require("../ultis/PaginationHelper");

const MEAL_REG_SELECT_FIELDS = `
    mr.id,
    mr.user_id,
    u.full_name AS user_full_name,
    mr.meal_id,
    m.meal_date,
    mr.guest_count,
    mr.status,
    mr.created_at
`;

const MEAL_REG_JOINS = `
    FROM meal_registration mr
    LEFT JOIN user u ON u.id = mr.user_id
    LEFT JOIN meal m ON m.id = mr.meal_id
`;

class MealRegistrationRepository {
  async list() {
    const [rows] = await pool.query(`
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      ORDER BY mr.id DESC
    `);

    return rows.map((row) => new MealRegistration(row));
  }

  async get(id) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.id = ?
      LIMIT 1
    `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new MealRegistration(rows[0]);
  }

  // Bảng trung gian có unique key (user_id, meal_id) -> tra cứu nhanh 1 user đã đăng ký ngày nào chưa
  async getByUserAndMeal(userId, mealId) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.user_id = ? AND mr.meal_id = ?
      LIMIT 1
    `,
      [userId, mealId],
    );

    if (rows.length === 0) {
      return null;
    }

    return new MealRegistration(rows[0]);
  }

  // Danh sách đăng ký ăn của riêng 1 nhân viên (API "của tôi")
  async listByUser(userId) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.user_id = ?
      ORDER BY m.meal_date DESC
    `,
      [userId],
    );

    return rows.map((row) => new MealRegistration(row));
  }

  // Danh sách toàn bộ user đăng ký ăn của 1 ngày cụ thể (để bếp biết nấu bao nhiêu suất)
  async listByMeal(mealId) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.meal_id = ?
      ORDER BY mr.id ASC
    `,
      [mealId],
    );

    return rows.map((row) => new MealRegistration(row));
  }

  async filter(userId, mealId, status, fromDate, toDate) {
    let sql = `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE 1 = 1
    `;

    const params = [];

    if (userId) {
      sql += ` AND mr.user_id = ? `;
      params.push(userId);
    }

    if (mealId) {
      sql += ` AND mr.meal_id = ? `;
      params.push(mealId);
    }

    if (status) {
      sql += ` AND mr.status = ? `;
      params.push(status);
    }

    if (fromDate) {
      sql += ` AND m.meal_date >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND m.meal_date <= ? `;
      params.push(toDate);
    }

    sql += ` ORDER BY m.meal_date DESC `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => new MealRegistration(row));
  }

  // Lọc dữ liệu kèm phân trang
  async filterPaginated(
    userId,
    mealId,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  ) {
    const { limit: validLimit, offset } =
      PaginationHelper.parsePagination(page, limit);

    let sql = `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE 1 = 1
    `;

    const params = [];

    if (userId) {
      sql += ` AND mr.user_id = ? `;
      params.push(userId);
    }

    if (mealId) {
      sql += ` AND mr.meal_id = ? `;
      params.push(mealId);
    }

    if (status) {
      sql += ` AND mr.status = ? `;
      params.push(status);
    }

    if (fromDate) {
      sql += ` AND m.meal_date >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND m.meal_date <= ? `;
      params.push(toDate);
    }

    // Count total
    const countSql = sql.replace(
      `SELECT ${MEAL_REG_SELECT_FIELDS}`,
      "SELECT COUNT(*) as total"
    );
    const [[{ total }]] = await pool.query(countSql, params);

    // Get paginated data
    sql += ` ORDER BY m.meal_date DESC `;
    sql = PaginationHelper.appendPaginationSQL(sql, validLimit, offset);
    const paginationParams = PaginationHelper.appendPaginationParams(
      params,
      validLimit,
      offset
    );

    const [rows] = await pool.query(sql, paginationParams);

    return {
      data: rows.map((row) => new MealRegistration(row)),
      pagination: PaginationHelper.createMeta(page, validLimit, total),
    };
  }

  async create(data) {
    const [result] = await pool.query(
      `
            INSERT INTO meal_registration (user_id, meal_id, guest_count, status, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `,
      [
        data.userId,
        data.mealId,
        data.guestCount || 0,
        data.status || "pending",
      ],
    );

    return this.get(result.insertId);
  }

  async update(id, data) {
    await pool.query(
      `
            UPDATE meal_registration
            SET
                guest_count = ?,
                status = ?
            WHERE id = ?
        `,
      [data.guestCount, data.status || "pending", id],
    );

    return this.get(id);
  }

  async updateStatus(id, status) {
    await pool.query(
      `
            UPDATE meal_registration
            SET status = ?
            WHERE id = ?
        `,
      [status, id],
    );

    return this.get(id);
  }

  // Hủy toàn bộ đăng ký (chưa ở trạng thái "cancelled") của 1 user rơi vào
  // khoảng ngày [fromDate, toDate]. Dùng để đồng bộ bảng meal_registration
  // ngay khi 1 yêu cầu cắt suất ăn (meal_option) được duyệt - vì trước đó có
  // thể đã tồn tại bản ghi đăng ký cho những ngày này (do job autoSchedule
  // tự tạo trước, hoặc do chính user đã tự đăng ký trước khi xin cắt).
  // Trả về danh sách bản ghi đã bị hủy (để service bắn audit log/notify).
  async cancelByUserAndDateRange(userId, fromDate, toDate) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.user_id = ?
        AND mr.status <> 'cancelled'
        AND m.meal_date BETWEEN ? AND ?
    `,
      [userId, fromDate, toDate],
    );

    if (rows.length === 0) {
      return [];
    }

    const affected = rows.map((row) => new MealRegistration(row));
    const ids = affected.map((row) => row.id);

    await pool.query(
      `
      UPDATE meal_registration
      SET status = 'cancelled'
      WHERE id IN (?)
    `,
      [ids],
    );

    return affected;
  }

  // Hủy toàn bộ đăng ký (chưa ở trạng thái "cancelled") của TẤT CẢ user rơi
  // vào khoảng ngày [fromDate, toDate] - không lọc theo user_id, khác với
  // cancelByUserAndDateRange() ở trên. Dùng khi QTV/quản lý tạo 1 sự kiện
  // "Hủy lịch" (nghỉ lễ/Tết/sự kiện toàn cơ quan) - xem services/HolidayEventService.js.
  async cancelAllByDateRange(fromDate, toDate) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.status <> 'cancelled'
        AND m.meal_date BETWEEN ? AND ?
    `,
      [fromDate, toDate],
    );

    if (rows.length === 0) {
      return [];
    }

    const affected = rows.map((row) => new MealRegistration(row));
    const ids = affected.map((row) => row.id);

    await pool.query(
      `
      UPDATE meal_registration
      SET status = 'cancelled'
      WHERE id IN (?)
    `,
      [ids],
    );

    return affected;
  }

  // Khôi phục lại toàn bộ đăng ký đang "cancelled" của TẤT CẢ user rơi vào
  // khoảng ngày [fromDate, toDate] về lại "confirmed" - ĐỐI XỨNG với
  // cancelAllByDateRange() ở trên. Dùng khi QTV/quản lý MỞ LẠI 1 sự kiện
  // "Hủy lịch" đã tạo nhầm (xem services/HolidayEventService.js#restore) -
  // nếu không có hàm này thì sau khi mở lại, bếp ăn hiển thị "Đang phục vụ"
  // trở lại nhưng suất ăn của mọi người vẫn ở trạng thái "cancelled" (lỗi
  // đã gặp trên thực tế: "mở lại lịch nhưng lịch vẫn hủy đăng ký toàn bộ
  // người dùng"). Trả về danh sách bản ghi đã được khôi phục (để service
  // bắn audit log/notify).
  async restoreAllByDateRange(fromDate, toDate) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_REG_SELECT_FIELDS}
      ${MEAL_REG_JOINS}
      WHERE mr.status = 'cancelled'
        AND m.meal_date BETWEEN ? AND ?
    `,
      [fromDate, toDate],
    );

    if (rows.length === 0) {
      return [];
    }

    const affected = rows.map((row) => new MealRegistration(row));
    const ids = affected.map((row) => row.id);

    await pool.query(
      `
      UPDATE meal_registration
      SET status = 'confirmed'
      WHERE id IN (?)
    `,
      [ids],
    );

    return affected;
  }

  // Đánh dấu toàn bộ đăng ký đang "confirmed" của 1 ngày (`dateStr`) sang
  // "completed" - tức suất ăn đã THỰC SỰ diễn ra (qua giờ ăn trưa), không
  // còn là "đã đăng ký" đơn thuần nữa. Dùng bởi jobs/mealCompletionJob.js
  // (chạy 12:00 trưa hàng ngày). Chỉ update các bản ghi đang "confirmed" nên
  // hàm này AN TOÀN khi gọi lặp lại nhiều lần trong ngày (idempotent) - phục
  // vụ cơ chế "catch-up" nếu server khởi động muộn.
  async completeConfirmedByDate(dateStr) {
    const [result] = await pool.query(
      `
      UPDATE meal_registration
      SET status = 'completed'
      WHERE meal_id IN (SELECT id FROM meal WHERE meal_date = ? AND is_cancelled = 0 AND status = 'active')
        AND status = 'confirmed'
    `,
      [dateStr],
    );

    return result.affectedRows;
  }

  async delete(id) {
    const [result] = await pool.query(
      `
            DELETE FROM meal_registration
            WHERE id = ?
        `,
      [id],
    );

    return result.affectedRows > 0;
  }

  // Tổng hợp số suất ăn (kèm khách) đã được xác nhận cho 1 ngày -> phục vụ bếp + thanh toán
  async getSummaryByMeal(mealId) {
    const [rows] = await pool.query(
      `
            SELECT
                COUNT(*) AS registered_count,
                COALESCE(SUM(guest_count), 0) AS guest_count_total
            FROM meal_registration
            WHERE meal_id = ? AND status IN ('confirmed','completed')
        `,
      [mealId],
    );

    const [[extra]] = await pool.query("SELECT COALESCE(SUM(g.guest_count),0) AS count FROM meal_guest_count g JOIN meal m ON m.id=g.meal_id WHERE g.meal_id=? AND m.is_cancelled=0 AND m.status='active'", [mealId]);
    return {
      registeredCount: Number(rows[0].registered_count) || 0,
      guestCountTotal: (Number(rows[0].guest_count_total) || 0) + Number(extra.count),
    };
  }
}

module.exports = MealRegistrationRepository;
