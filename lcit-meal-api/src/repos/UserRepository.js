const pool = require("../config/database");
const User = require("../models/User");

const USER_STATUS = require("../constants/UserStatus");

const USER_SELECT_FIELDS = `
    u.id,
    u.full_name,
    u.phone,
    u.facility_id,
    u.username,
    u.password_hash,
    u.auth_key,
    u.access_token,
    u.status,
    u.created_at,
    u.created_by,
    u.updated_at,
    u.updated_by,
    r.id AS role_id,
    r.display_name AS role_display_name,
    r.code AS role_code,
    r.description AS role_description,
    r.status AS role_status
`;

const USER_JOIN_ROLES = `
    FROM user u
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.id = ur.role_id
`;

class UserRepository {
  // map records to User Model (gộp nhiều role của cùng 1 user do JOIN)
  mapUsers(rows) {
    const users = new Map();

    for (const row of rows) {
      if (!users.has(row.id)) {
        users.set(row.id, {
          user: new User(row),
          roles: [],
        });
      }

      if (row.role_id) {
        users.get(row.id).roles.push({
          id: row.role_id,
          displayName: row.role_display_name,
          code: row.role_code,
          description: row.role_description,
          status: row.role_status,
        });
      }
    }

    return Array.from(users.values()).map((item) => {
      item.user.roles = item.roles;
      return item.user;
    });
  }

  // Get list users
  async list() {
    const [rows] = await pool.query(`
      SELECT ${USER_SELECT_FIELDS}
      ${USER_JOIN_ROLES}
      ORDER BY u.id DESC
    `);

    return this.mapUsers(rows);
  }

  // Get user by id
  async get(id) {
    const [rows] = await pool.query(
      `
      SELECT ${USER_SELECT_FIELDS}
      ${USER_JOIN_ROLES}
      WHERE u.id = ?
      ORDER BY u.id DESC
    `,
      [id],
    );

    const users = this.mapUsers(rows);

    return users.length > 0 ? users[0] : null;
  }

  // Get user by username (kèm roles) - dùng cho login & kiểm tra trùng username
  async getByUsername(username) {
    const [rows] = await pool.query(
      `
      SELECT ${USER_SELECT_FIELDS}
      ${USER_JOIN_ROLES}
      WHERE u.username = ?
      ORDER BY u.id DESC
    `,
      [username],
    );

    const users = this.mapUsers(rows);

    return users.length > 0 ? users[0] : null;
  }

  async usernameExists(username, excludeId = null) {
    const params = [username];
    let sql = "SELECT id FROM user WHERE username = ?";
    if (excludeId) {
      sql += " AND id <> ?";
      params.push(excludeId);
    }
    sql += " LIMIT 1";
    const [rows] = await pool.query(sql, params);
    return rows.length > 0;
  }

  async phoneExists(phone, excludeId = null) {
    const params = [phone];
    let sql = 'SELECT id FROM user WHERE phone = ?';
    if (excludeId !== null) { sql += ' AND id <> ?'; params.push(excludeId); }
    const [rows] = await pool.query(sql + ' LIMIT 1', params);
    return rows.length > 0;
  }

  async updateAccessToken(id, accessToken) {
    await pool.query(
      `
        UPDATE user
        SET
            access_token = ?,
            updated_at = NOW()
        WHERE id = ?
    `,
      [accessToken, id],
    );

    return true;
  }

  async revokeAccessToken(id, token) {
    await pool.query('UPDATE user SET access_token = NULL WHERE id = ? AND access_token = ?', [id, token]);
  }

  // Filter users
  async filter(query, role, status) {
    let sql = `
      SELECT ${USER_SELECT_FIELDS}
      ${USER_JOIN_ROLES}
      WHERE 1 = 1
    `;

    const params = [];

    // Search full_name / username
    if (query) {
      sql += `
                AND (
                    u.full_name LIKE ?
                    OR u.username LIKE ?
                )
            `;
      const keyword = `%${query}%`;
      params.push(keyword);
      params.push(keyword);
    }

    // Filter role
    if (role) {
      sql += `
                AND (
                    r.id = ?
                    OR r.code = ?
                )
            `;
      params.push(role);
      params.push(role);
    }

    // Filter status
    if (status !== undefined && status !== null && status !== "") {
      sql += `
                AND u.status = ?
            `;
      params.push(status);
    }

    sql += `
            ORDER BY u.id DESC
        `;

    const [rows] = await pool.query(sql, params);

    return this.mapUsers(rows);
  }

  // Create new user
  async create(data) {
    const [result] = await pool.query(
      `
            INSERT INTO user (
                full_name,
                phone,
                username,
                password_hash,
                auth_key,
                access_token,
                status,
                created_at,
                created_by,
                updated_at,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)
        `,
      [
        data.fullName,
        data.phone ?? null,
        data.username,
        data.passwordHash,
        data.authKey,
        data.accessToken || null,
        data.status || USER_STATUS.STATUS_ACTIVE,
        data.createdBy,
        data.createdBy,
      ],
    );

    return this.get(result.insertId);
  }

  async createBatch(users) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const userIds = [];

      for (const data of users) {
        const [result] = await connection.query(
          `
                INSERT INTO user (
                    full_name, phone, username, password_hash, auth_key,
                    access_token, status, created_at, created_by,
                    updated_at, updated_by
                )
                VALUES (?, ?, ?, ?, ?, NULL, ?, NOW(), ?, NOW(), ?)
            `,
          [
            data.fullName,
            data.phone ?? null,
            data.username,
            data.passwordHash,
            data.authKey,
            data.status || USER_STATUS.STATUS_ACTIVE,
            data.createdBy,
            data.createdBy,
          ],
        );

        await connection.query(
          `
                INSERT INTO user_role (user_id, role_id, status, created_at, created_by)
                VALUES (?, ?, 'active', NOW(), ?)
            `,
          [result.insertId, data.roleId, data.createdBy],
        );
        userIds.push(result.insertId);
      }

      await connection.commit();
      return userIds;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update user
  async update(id, data) {
    const [result] = await pool.query(
      `
            UPDATE user
            SET
                full_name = ?,
                phone = ?,
                username = ?,
                password_hash = ?,
                status = ?,
                updated_at = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [
        data.fullName,
        data.phone ?? null,
        data.username,
        data.passwordHash,
        data.status,
        data.updatedBy,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.get(id);
  }

  // Soft delete
  async delete(id, actorId) {
    const [result] = await pool.query(
      `
            UPDATE user
            SET
                status = ?,
                updated_at = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [USER_STATUS.STATUS_DELETED, actorId, id],
    );

    return result.affectedRows > 0;
  }

  // Permanent delete
  async forceDelete(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Xóa bảng trung gian trước
      await connection.query(
        `
                DELETE FROM user_role
                WHERE user_id = ?
            `,
        [id],
      );

      // Xóa user
      const [result] = await connection.query(
        `
                DELETE FROM user
                WHERE id = ?
            `,
        [id],
      );

      await connection.commit();

      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Lấy danh sách id của tất cả user đang active (dùng để broadcast notification)
  async getAllActiveIds() {
    const [rows] = await pool.query(
      `
            SELECT id
            FROM user
            WHERE status = ?
        `,
      [USER_STATUS.STATUS_ACTIVE],
    );

    return rows.map((row) => row.id);
  }

  // Lấy danh sách id user thuộc 1 hoặc nhiều role (vd: thông báo cho toàn bộ admin + manager)
  // Dùng cho NotificationService.notifyRoles() - bảng trung gian user_role
  async getIdsByRoleCodes(roleCodes) {
    if (!roleCodes || roleCodes.length === 0) {
      return [];
    }

    const [rows] = await pool.query(
      `
            SELECT DISTINCT u.id
            FROM user u
            INNER JOIN user_role ur ON ur.user_id = u.id
            INNER JOIN role r ON r.id = ur.role_id
            WHERE r.code IN (?)
                AND u.status = ?
        `,
      [roleCodes, USER_STATUS.STATUS_ACTIVE],
    );

    return rows.map((row) => row.id);
  }

  // Gán role cho user (dùng khi tạo user mới hoặc phân quyền lại)
  async assignRole(userId, roleId, actorId) {
    await pool.query(
      `
            INSERT INTO user_role (
                user_id,
                role_id,
                status,
                created_at,
                created_by
            )
            VALUES (?, ?, 'active', NOW(), ?)
        `,
      [userId, roleId, actorId],
    );

    return true;
  }

  // Đổi role của user: gỡ toàn bộ role hiện tại rồi gán role mới.
  // Dùng khi cập nhật người dùng (UserForm cho phép đổi "Vai trò").
  async setRole(userId, roleId, actorId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        `
                DELETE FROM user_role
                WHERE user_id = ?
            `,
        [userId],
      );

      await connection.query(
        `
                INSERT INTO user_role (
                    user_id,
                    role_id,
                    status,
                    created_at,
                    created_by
                )
                VALUES (?, ?, 'active', NOW(), ?)
            `,
        [userId, roleId, actorId],
      );

      await connection.commit();

      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = UserRepository;
