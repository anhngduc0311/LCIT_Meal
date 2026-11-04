const pool = require("../config/database");
const MealOption = require("../models/MealOption");
const AppError = require('../ultis/AppError');

const MEAL_OPTION_SELECT_FIELDS = `
    mo.id,
    mo.user_id,
    u.full_name AS user_full_name,
    mo.type,
    DATE_FORMAT(mo.from_date, '%Y-%m-%d') AS from_date,
    DATE_FORMAT(mo.to_date, '%Y-%m-%d') AS to_date,
    mo.note,
    mo.status,
    mo.created_at,
    mo.created_by,
    mo.updated_at,
    mo.updated_by,
    mo.approved_at,
    mo.approved_by
`;

const MEAL_OPTION_JOIN_USER = `
    FROM meal_option mo
    LEFT JOIN user u ON u.id = mo.user_id
`;

class MealOptionRepository {
  async list() {
    const [rows] = await pool.query(`
      SELECT ${MEAL_OPTION_SELECT_FIELDS}
      ${MEAL_OPTION_JOIN_USER}
      ORDER BY mo.id DESC
    `);

    return rows.map((row) => new MealOption(row));
  }

  async get(id, db = pool) {
    const [rows] = await db.query(
      `
      SELECT ${MEAL_OPTION_SELECT_FIELDS}
      ${MEAL_OPTION_JOIN_USER}
      WHERE mo.id = ?
      LIMIT 1
    `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new MealOption(rows[0]);
  }

  // Danh sách yêu cầu hủy ăn của riêng 1 nhân viên (dùng cho API "của tôi")
  async listByUser(userId) {
    const [rows] = await pool.query(
      `
      SELECT ${MEAL_OPTION_SELECT_FIELDS}
      ${MEAL_OPTION_JOIN_USER}
      WHERE mo.user_id = ?
      ORDER BY mo.id DESC
    `,
      [userId],
    );

    return rows.map((row) => new MealOption(row));
  }

  async filter(userId, type, status) {
    let sql = `
      SELECT ${MEAL_OPTION_SELECT_FIELDS}
      ${MEAL_OPTION_JOIN_USER}
      WHERE 1 = 1
    `;

    const params = [];

    if (userId) {
      sql += ` AND mo.user_id = ? `;
      params.push(userId);
    }

    if (type) {
      sql += ` AND mo.type = ? `;
      params.push(type);
    }

    if (status) {
      sql += ` AND mo.status = ? `;
      params.push(status);
    }

    sql += ` ORDER BY mo.id DESC `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => new MealOption(row));
  }

  async create(data) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      // Serialize submissions for the same person, including concurrent requests
      // from multiple devices or submitted on their behalf by management.
      const [[user]] = await db.query('SELECT id FROM user WHERE id=? FOR UPDATE', [data.userId]);
      if (!user) throw new AppError('Cán bộ không tồn tại', 404);
      const [[pending]] = await db.query("SELECT id FROM meal_option WHERE user_id=? AND status='pending' LIMIT 1", [data.userId]);
      if (pending) throw new AppError('Bạn đang có yêu cầu cắt suất chờ duyệt. Vui lòng chờ quản lý duyệt hoặc từ chối trước khi gửi yêu cầu tiếp.', 409);
    const [result] = await db.query(
      `
            INSERT INTO meal_option (
                user_id, type, from_date, to_date, note, status,
                created_at, created_by, approved_at, approved_by
            )
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `,
      [
        data.userId,
        data.type,
        data.fromDate,
        data.toDate,
        data.note || null,
        data.status || "pending",
        data.createdBy,
        data.approvedAt || null,
        data.approvedBy || null,
      ],
    );

      const option = await this.get(result.insertId, db);
      await db.commit();
      return option;
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  }

  async update(id, data) {
    await pool.query(
      `
            UPDATE meal_option
            SET
                type = ?,
                from_date = ?,
                to_date = ?,
                note = ?,
                updated_at = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [data.type, data.fromDate, data.toDate, data.note, data.updatedBy, id],
    );

    return this.get(id);
  }

  // Duyệt / từ chối yêu cầu
  async setDecision(id, status, approvedBy, note) {
    await pool.query(
      `
            UPDATE meal_option
            SET
                status = ?,
                approved_at = NOW(),
                approved_by = ?,
                note = COALESCE(?, note),
                updated_at = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [status, approvedBy, note || null, approvedBy, id],
    );

    return this.get(id);
  }

  // "Xác nhận đăng ký ăn lại" - kết thúc SỚM 1 yêu cầu cắt suất đã duyệt
  // (cancel_permanent/cancel_schedule) bằng cách rút ngắn `to_date` lại
  // (thường là hôm qua so với ngày hiệu lực đăng ký lại), để từ ngày hiệu
  // lực trở đi user không còn bị coi là "đã cắt suất" nữa - xem
  // services/MealOptionService.js#reactivate().
  async closeEarly(id, newToDate, updatedBy) {
    await pool.query(
      `
            UPDATE meal_option
            SET
                to_date = ?,
                updated_at = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [newToDate, updatedBy, id],
    );

    return this.get(id);
  }

  async reactivateWithRegistrations(id, fromDate, actorId) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const [[option]] = await db.query(`SELECT *, DATE_FORMAT(from_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(to_date, '%Y-%m-%d') AS end_date FROM meal_option WHERE id=? FOR UPDATE`, [id]);
      if (!option) throw new AppError('Yêu cầu cắt suất không tồn tại', 404);
      if (option.status !== 'approved' || !['cancel_permanent', 'cancel_schedule'].includes(option.type) || option.end_date < fromDate) {
        throw new AppError('Yêu cầu này không còn hiệu lực để khôi phục', 409);
      }
      // Lock the user as well so concurrent restorations for overlapping requests serialize.
      const [[user]] = await db.query('SELECT status FROM user WHERE id=? FOR UPDATE', [option.user_id]);
      if (!user || String(user.status) !== '1') throw new AppError('Tài khoản này không còn hoạt động', 409);
      if (fromDate <= option.start_date) {
        await db.query("UPDATE meal_option SET status='rejected', updated_by=?, updated_at=NOW() WHERE id=?", [actorId,id]);
      } else {
        const previousDay = new Date(Date.parse(`${fromDate}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
        await db.query('UPDATE meal_option SET to_date=?, updated_by=?, updated_at=NOW() WHERE id=?', [previousDay,actorId,id]);
      }
      const [meals] = await db.query(`SELECT m.id FROM meal m
        WHERE m.meal_date BETWEEN ? AND ? AND m.is_cancelled=0 AND m.status='active'
          AND NOT EXISTS (SELECT 1 FROM holiday_event h WHERE h.status='active' AND m.meal_date BETWEEN h.from_date AND h.to_date)
          AND NOT EXISTS (SELECT 1 FROM meal_option mo WHERE mo.user_id=? AND mo.status='approved'
            AND m.meal_date BETWEEN mo.from_date AND mo.to_date)
        ORDER BY m.meal_date FOR UPDATE`, [fromDate > option.start_date ? fromDate : option.start_date,option.end_date,option.user_id]);
      let restoredCount = 0;
      for (const meal of meals) {
        const [[existing]] = await db.query('SELECT id,status FROM meal_registration WHERE user_id=? AND meal_id=? FOR UPDATE', [option.user_id,meal.id]);
        if (!existing) {
          await db.query("INSERT INTO meal_registration (user_id,meal_id,guest_count,status,created_at) VALUES (?,?,0,'confirmed',NOW())", [option.user_id,meal.id]);
          restoredCount++;
        } else if (existing.status === 'cancelled') {
          await db.query("UPDATE meal_registration SET status='confirmed',guest_count=0 WHERE id=?", [existing.id]);
          restoredCount++;
        }
      }
      const result = { option: await this.get(id,db), fromDate, restoredCount };
      await db.commit();
      return result;
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  }

  async delete(id) {
    const [result] = await pool.query(
      `
            DELETE FROM meal_option
            WHERE id = ?
        `,
      [id],
    );

    return result.affectedRows > 0;
  }
}

module.exports = MealOptionRepository;
