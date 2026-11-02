const pool = require("../config/database");
const Payment = require("../models/Payment");

const PAYMENT_SELECT_FIELDS = `
    p.id,
    p.user_id,
    u.full_name AS user_full_name,
    p.payment_date,
    p.amount,
    p.is_paid,
    p.paid_at,
    p.paid_amount,
    p.bill_img,
    p.status
`;

const PAYMENT_JOIN_USER = `
    FROM payment p
    LEFT JOIN user u ON u.id = p.user_id
`;

class PaymentRepository {
  async getMealLedgerDays(userId) {
    const [settings] = await pool.query("SELECT setting_key, setting_value FROM system_setting WHERE setting_key IN ('meal_price','guest_meal_price')");
    const value = key => Number(settings.find(s => s.setting_key === key)?.setting_value);
    const price = value('meal_price'), guestPrice = value('guest_meal_price');
    if (![price, guestPrice].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Chưa cấu hình đơn giá suất ăn');
    const [rows] = await pool.query(`SELECT m.meal_date AS date, COUNT(*) AS staff, SUM(r.guest_count) AS guests
      FROM meal_registration r JOIN meal m ON m.id=r.meal_id
      WHERE r.user_id=? AND r.status='completed' AND m.is_cancelled=0 AND m.status='active' AND m.meal_date<=CURDATE()
      GROUP BY m.meal_date ORDER BY m.meal_date`, [userId]);
    return rows.map(row => ({ ...row, amount: Number(row.staff) * price + Number(row.guests) * guestPrice }));
  }

  async list() {
    const [rows] = await pool.query(`
      SELECT ${PAYMENT_SELECT_FIELDS}
      ${PAYMENT_JOIN_USER}
      ORDER BY p.payment_date DESC
    `);

    return rows.map((row) => new Payment(row));
  }

  async get(id) {
    const [rows] = await pool.query(
      `
      SELECT ${PAYMENT_SELECT_FIELDS}
      ${PAYMENT_JOIN_USER}
      WHERE p.id = ?
      LIMIT 1
    `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new Payment(rows[0]);
  }

  // Lịch sử thanh toán của riêng 1 nhân viên (API "của tôi")
  async listByUser(userId) {
    const [rows] = await pool.query(
      `
      SELECT ${PAYMENT_SELECT_FIELDS}
      ${PAYMENT_JOIN_USER}
      WHERE p.user_id = ?
      ORDER BY p.payment_date DESC
    `,
      [userId],
    );

    return rows.map((row) => new Payment(row));
  }

  async listUnpaid() {
    const [rows] = await pool.query(`
      SELECT ${PAYMENT_SELECT_FIELDS}
      ${PAYMENT_JOIN_USER}
      WHERE p.status IN ('unpaid', 'overdue') AND u.status = '1'
      ORDER BY p.user_id, p.payment_date DESC
    `);
    return rows.map((row) => new Payment(row));
  }

  async markOverdue(id) {
    await pool.query(
      `UPDATE payment SET status = 'overdue' WHERE id = ? AND status = 'unpaid'`,
      [id],
    );
  }

  async filter(userId, status, fromDate, toDate) {
    let sql = `
      SELECT ${PAYMENT_SELECT_FIELDS}
      ${PAYMENT_JOIN_USER}
      WHERE 1 = 1
    `;

    const params = [];

    if (userId) {
      sql += ` AND p.user_id = ? `;
      params.push(userId);
    }

    if (status) {
      sql += ` AND p.status = ? `;
      params.push(status);
    }

    if (fromDate) {
      sql += ` AND p.payment_date >= ? `;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND p.payment_date <= ? `;
      params.push(toDate);
    }

    sql += ` ORDER BY p.payment_date DESC `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => new Payment(row));
  }

  async create(data) {
    const [result] = await pool.query(
      `
            INSERT INTO payment (user_id, payment_date, amount, is_paid, status)
            VALUES (?, ?, ?, 0, ?)
        `,
      [data.userId, data.paymentDate, data.amount, data.status],
    );

    return this.get(result.insertId);
  }

  async update(id, data) {
    await pool.query(
      `
            UPDATE payment
            SET
                payment_date = ?,
                amount = ?,
                status = ?
            WHERE id = ?
        `,
      [data.paymentDate, data.amount, data.status, id],
    );

    return this.get(id);
  }

  // Xác nhận đã thanh toán (kèm số tiền thực trả + ảnh hóa đơn)
  async markPaid(id, data) {
    await pool.query(
      `
            UPDATE payment
            SET
                is_paid = 1,
                paid_at = NOW(),
                paid_amount = ?,
                bill_img = COALESCE(?, bill_img),
                status = ?
            WHERE id = ?
        `,
      [data.paidAmount, data.billImg || null, data.status, id],
    );

    return this.get(id);
  }

  async delete(id) {
    const [result] = await pool.query(
      `
            DELETE FROM payment
            WHERE id = ?
        `,
      [id],
    );

    return result.affectedRows > 0;
  }
}

module.exports = PaymentRepository;
