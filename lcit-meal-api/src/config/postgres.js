const { Pool, types } = require('pg');

// Keep the API's DATE/count/amount shapes compatible with the existing client.
types.setTypeParser(1082, value => value);
types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds JavaScript safe range');
  return number;
});
types.setTypeParser(1700, Number);

const idTables = new Set(['user', 'user_role', 'role', 'meal', 'meal_option',
  'meal_registration', 'payment', 'notification', 'notification_recipient',
  'system_setting', 'meal_schedule_config', 'holiday_event', 'audit_log']);
const conflictColumns = {
  meal_guest_count: 'meal_id, facility_id',
  meal: 'meal_date', meal_registration: 'user_id, meal_id',
  system_setting: 'setting_key', meal_schedule_config: 'day_of_week',
};

// Transitional repository boundary: parameterized queries and transaction/result
// contracts stay stable while PostgreSQL receives its native syntax.
function compile(sql, values = []) {
  let text = sql.trim().replace(/;$/, '');
  const params = [];
  const insert = text.match(/^INSERT\s+(IGNORE\s+)?INTO\s+`?(\w+)`?/i);
  text = text.replace(/`([^`]+)`/g, '"$1"')
    .replace(/\b(FROM|JOIN|INTO|UPDATE)\s+user\b/gi, '$1 "user"')
    .replace(/\bLIKE\b/gi, 'ILIKE')
    .replace(/CURDATE\(\)/gi, "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date")
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')")
    .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/gi, "TO_CHAR($1, 'YYYY-MM')")
    .replace(/DATE_SUB\(CAST\(\? AS DATE\), INTERVAL (\d+) DAY\)/gi, '(CAST(? AS DATE) - $1)')
    .replace(/DATE_ADD\((\w+), INTERVAL (\d+) DAY\)/gi, '($1 + $2)');
  if (insert?.[1]) text = text.replace(/^INSERT IGNORE/i, 'INSERT');
  if (/ON DUPLICATE KEY UPDATE/i.test(text)) {
    const table = insert?.[2];
    if (!conflictColumns[table]) throw new Error(`Unsupported upsert table: ${table}`);
    text = text.replace(/ON DUPLICATE KEY UPDATE\s+id\s*=\s*id/i, 'ON CONFLICT DO NOTHING')
      .replace(/ON DUPLICATE KEY UPDATE/i, `ON CONFLICT (${conflictColumns[table]}) DO UPDATE SET`)
      .replace(/VALUES\((\w+)\)/gi, 'EXCLUDED.$1');
  } else if (insert?.[1]) text += ' ON CONFLICT DO NOTHING';

  // Only substitute placeholders outside string and identifier literals.
  let index = 0;
  let quote = null;
  let output = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      output += char;
      if (char === quote) {
        if (text[i + 1] === quote) output += text[++i];
        else quote = null;
      }
    } else if (char === "'" || char === '"') { quote = char; output += char; }
    else if (char === '?') {
      if (index >= values.length) throw new Error('Missing SQL parameter');
      const value = values[index++];
      const bind = item => { params.push(item === undefined ? null : item); return `$${params.length}`; };
      output += Array.isArray(value)
        ? value.length ? value.map(item => Array.isArray(item) ? `(${item.map(bind).join(',')})` : bind(item)).join(',') : 'NULL'
        : bind(value);
    } else output += char;
  }
  if (index !== values.length) throw new Error('Unused SQL parameters');
  if (insert && idTables.has(insert[2]) && !/\bRETURNING\b/i.test(output)) output += ' RETURNING id';
  return { text: output, values: params };
}

function wrap(client) {
  return {
    dialect: 'postgres',
    async query(sql, values) {
      try {
        const result = await client.query(compile(sql, values));
        if (result.command === 'SELECT') return [result.rows];
        return [{ affectedRows: result.rowCount, insertId: result.rows[0]?.id }];
      } catch (error) {
        const codes = { '23505': 'ER_DUP_ENTRY', '23503': 'ER_ROW_IS_REFERENCED_2', '40P01': 'ER_LOCK_DEADLOCK' };
        if (codes[error.code]) { error.pgCode = error.code; error.code = codes[error.code]; }
        throw error;
      }
    },
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

function createPool(connectionString, schema = 'public') {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
  const url = new URL(connectionString);
  for (const key of ['sslmode', 'channel_binding']) url.searchParams.delete(key);
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true },
    enableChannelBinding: true, max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000,
    options: `-c timezone=Asia/Ho_Chi_Minh${schema === 'public' ? '' : ` -c search_path=${schema}`}` });
  pool.on('error', error => console.error('PostgreSQL connection error:', error.code));
  return { ...wrap(pool), native: pool, end: () => pool.end(),
    getConnection: async () => wrap(await pool.connect()) };
}

module.exports = { createPool, compile };
