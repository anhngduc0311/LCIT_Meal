const pool = require("../config/database");
const Notification = require("../models/Notification");

class NotificationRepository {
  async list() {
    const [rows] = await pool.query(`
            SELECT
                id,
                title,
                content,
                url,
                status,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM notification
            WHERE status <> '0'
            ORDER BY id DESC
        `);

    return rows.map((row) => new Notification(row));
  }

  async get(id, connection = pool) {
    const [rows] = await connection.query(
      `
            SELECT
                id,
                title,
                content,
                url,
                status,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM notification
            WHERE id = ?
            LIMIT 1
        `,
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return new Notification(rows[0]);
  }

  async filter(query, status) {
    let sql = `
            SELECT
                id,
                title,
                content,
                url,
                status,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM notification
            WHERE 1 = 1
        `;

    const params = [];

    if (query) {
      sql += `
                AND (
                    title LIKE ?
                    OR content LIKE ?
                )
            `;

      const keyword = `%${query}%`;

      params.push(keyword, keyword);
    }

    if (status !== undefined && status !== null && status !== "") {
      sql += `
                AND status = ?
            `;

      params.push(status);
    } else {
      sql += " AND status <> '0'";
    }

    sql += `
            ORDER BY id DESC
        `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => new Notification(row));
  }

  async create(data, connection = pool) {
    const status = data.status || "active"; // Default status to 'active' if not provided
    const [result] = await connection.query(
      `
            INSERT INTO notification (
                title,
                content,
                url,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?)
        `,
      [data.title, data.content, data.url, status, data.createdBy],
    );

    return this.get(result.insertId, connection);
  }

  async createWithRecipients(data, userIds) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const notification = await this.create(data, connection);
      await this.addRecipients(notification.id, userIds, connection);
      await connection.commit();
      return notification;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id, data) {
    await pool.query(
      `
            UPDATE notification
            SET
                title = ?,
                content = ?,
                url = ?,
                status = ?,
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
        `,
      [data.title, data.content, data.url, data.status, data.updatedBy, id],
    );

    return this.get(id);
  }

  async delete(id, updatedBy) {
    await pool.query(
      `
            UPDATE notification
            SET
                status = '0',
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
        `,
      [updatedBy, id],
    );

    return true;
  }

  // ===== Bảng trung gian notification_recipient (User <-> Notification) =====

  // Gửi 1 notification đã tạo tới danh sách user (bulk insert)
  async addRecipients(notificationId, userIds, connection = pool) {
    const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

    if (uniqueUserIds.length === 0) {
      return 0;
    }

    const values = uniqueUserIds.map((userId) => [userId, notificationId]);

    const [result] = await connection.query(
      `
            INSERT INTO notification_recipient (user_id, notification_id)
            VALUES ?
        `,
      [values],
    );

    return result.affectedRows;
  }

  // Danh sách id user đã nhận 1 notification
  async getRecipientUserIds(notificationId) {
    const [rows] = await pool.query(
      `
            SELECT user_id
            FROM notification_recipient
            WHERE notification_id = ?
        `,
      [notificationId],
    );

    return rows.map((row) => row.user_id);
  }

  // Danh sách notification của 1 user cụ thể (kèm trạng thái đã xem hay chưa)
  // join notification_recipient (bảng trung gian) với notification
  async listForUser(userId, onlyUnseen = false) {
    let sql = `
            SELECT
                n.id,
                n.title,
                n.content,
                n.url,
                n.status,
                n.created_at,
                n.created_by,
                n.updated_at,
                n.updated_by,
                nr.id AS recipient_id,
                nr.is_seen,
                nr.seen_at
            FROM notification_recipient nr
            INNER JOIN notification n ON n.id = nr.notification_id
            WHERE nr.user_id = ?
              AND n.status <> '0'
        `;

    const params = [userId];

    if (onlyUnseen) {
      sql += ` AND nr.is_seen = 0 `;
    }

    sql += ` ORDER BY n.id DESC `;

    const [rows] = await pool.query(sql, params);

    return rows.map((row) => {
      const notification = new Notification(row);
      notification.recipientId = row.recipient_id;
      notification.isSeen = !!Number(row.is_seen);
      notification.seenAt = row.seen_at;
      return notification;
    });
  }

  // Đếm số notification chưa xem của 1 user (hiển thị badge)
  async countUnseenForUser(userId) {
    const [rows] = await pool.query(
      `
            SELECT COUNT(*) AS total
            FROM notification_recipient nr
            INNER JOIN notification n ON n.id = nr.notification_id
            WHERE nr.user_id = ? AND nr.is_seen = 0 AND n.status <> '0'
        `,
      [userId],
    );

    return Number(rows[0].total) || 0;
  }

  async hasPaymentReminderToday(userId, paymentId) {
    const [rows] = await pool.query(
      `
      SELECT nr.id
      FROM notification_recipient nr
      JOIN notification n ON n.id = nr.notification_id
      WHERE nr.user_id = ?
        AND n.created_by IS NULL
        AND n.url = ?
        AND DATE(n.created_at) = CURDATE()
      LIMIT 1
    `,
      [userId, `/payments/${paymentId}`],
    );
    return rows.length > 0;
  }

  // Đánh dấu đã xem 1 notification của đúng user đó (không được đánh dấu hộ user khác)
  async markSeen(notificationId, userId) {
    const [result] = await pool.query(
      `
            UPDATE notification_recipient
            SET is_seen = 1, seen_at = NOW()
            WHERE notification_id = ? AND user_id = ?
        `,
      [notificationId, userId],
    );

    return result.affectedRows > 0;
  }

  // Đánh dấu tất cả notification của 1 user là đã xem
  async markAllSeenForUser(userId) {
    const [result] = await pool.query(
      `
            UPDATE notification_recipient
            SET is_seen = 1, seen_at = NOW()
            WHERE user_id = ? AND is_seen = 0
        `,
      [userId],
    );

    return result.affectedRows;
  }
}

module.exports = NotificationRepository;
