const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });
const { createPool } = require('../../src/config/postgres');
const url = new URL(process.env.DATABASE_URL);
url.hostname = url.hostname.replace('-pooler.', '.');
process.env.DATABASE_URL = url.toString();
const schema = `appmeal_auth_qa_${Date.now()}_${process.pid}`;
const admin = createPool(process.env.DATABASE_URL);
let pool;

async function main() {
  await admin.native.query(`CREATE SCHEMA ${schema}`);
  process.env.DATABASE_SCHEMA = schema;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  pool = require('../../src/config/database');
  await require('../migrate-postgres.cjs')(pool);
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const password = crypto.randomBytes(16).toString('hex');
  const [insert] = await pool.query('INSERT INTO user(full_name,username,password_hash,auth_key,status) VALUES(?,?,?,?,?)',
    ['Auth QA', 'authqa', await bcrypt.hash(password, 4), crypto.randomBytes(16).toString('hex'), '1']);
  const id = insert.insertId;
  const users = new (require('../../src/repos/UserRepository'))();
  const service = new (require('../../src/services/AuthService'))(users, { async create() {} });
  const legacy = jwt.sign({ id, exp: 1 }, process.env.JWT_SECRET);
  await users.updateAccessToken(id, legacy);
  const first = (await service.login('authqa', password)).accessToken;
  const second = (await service.login('authqa', password)).accessToken;
  assert.notEqual(first, second);
  const middleware = require('../../src/middlewares/authMiddleware');
  async function accepted(token) {
    let result = false;
    const res = { status() { return this; }, json() { return this; } };
    await middleware({ headers: { authorization: `Bearer ${token}` } }, res, error => {
      if (error) throw error;
      result = true;
    });
    return result;
  }
  for (const token of [legacy, first, second]) assert.equal(await accepted(token), true);
  const [rows] = await pool.query('SELECT token_hash FROM auth_session WHERE user_id = ?', [id]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.token_hash)));
  await service.logout(id, second);
  assert.equal(await accepted(second), false);
  assert.equal(await accepted(first), true);
  assert.equal(await accepted(legacy), true);
  await service.logout(id, legacy);
  assert.equal(await accepted(legacy), false);
  assert.equal(await accepted(first), true);
  await service.logout(id, first);
  assert.equal(await accepted(first), false);
  console.log('PostgreSQL auth integration passed: independent persistent sessions, legacy compatibility, hashed tokens, per-device logout.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (pool) await pool.end();
  if (!/^appmeal_auth_qa_\d+_\d+$/.test(schema)) throw new Error('Unexpected QA schema');
  await admin.native.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
