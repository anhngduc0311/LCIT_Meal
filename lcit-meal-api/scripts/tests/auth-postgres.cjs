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
  assert.equal(await accepted(legacy), false);
  assert.equal(await accepted(first), false);
  assert.equal(await accepted(second), true);
  assert.equal(jwt.verify(second, process.env.JWT_SECRET, {
    clockTimestamp: Math.floor(Date.now() / 1000) + 100 * 365 * 86400,
  }).exp, undefined);
  await service.logout(id, legacy);
  await service.logout(id, first);
  assert.equal(await accepted(second), true);
  await service.logout(id, second);
  assert.equal(await accepted(second), false);
  console.log('PostgreSQL auth integration passed: newest-device-only login, no expiry, delayed old logout cannot revoke the new session.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (pool) await pool.end();
  if (!/^appmeal_auth_qa_\d+_\d+$/.test(schema)) throw new Error('Unexpected QA schema');
  await admin.native.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
