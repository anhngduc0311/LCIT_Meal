const crypto = require('node:crypto');
const pool = require('../config/database');

// Store only token digests; each login can be revoked independently.
let ready;
function ensureTable() {
  if (!ready) {
    ready = pool.query(`CREATE TABLE IF NOT EXISTS auth_session (
      token_hash VARCHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).catch(error => { ready = undefined; throw error; });
  }
  return ready;
}
const digest = token => crypto.createHash('sha256').update(token).digest('hex');

class AuthSessionRepository {
  async create(userId, token) {
    await ensureTable();
    await pool.query('INSERT INTO auth_session (token_hash, user_id) VALUES (?, ?)', [digest(token), userId]);
  }

  async exists(userId, token) {
    await ensureTable();
    const [rows] = await pool.query('SELECT token_hash FROM auth_session WHERE token_hash = ? AND user_id = ?', [digest(token), userId]);
    return rows.length > 0;
  }

  async revoke(userId, token) {
    await ensureTable();
    await pool.query('DELETE FROM auth_session WHERE token_hash = ? AND user_id = ?', [digest(token), userId]);
  }
}

module.exports = AuthSessionRepository;
