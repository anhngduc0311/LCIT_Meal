const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });
const { createPool } = require('../../src/config/postgres');
const url = new URL(process.env.DATABASE_URL);
url.hostname = url.hostname.replace('-pooler.', '.');
process.env.DATABASE_URL = url.toString();
const schema = `appmeal_restore_qa_${Date.now()}_${process.pid}`;
const adminPool = createPool(process.env.DATABASE_URL);
let pool, server;
async function main() {
  await adminPool.native.query(`CREATE SCHEMA ${schema}`);
  process.env.DATABASE_SCHEMA = schema;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  pool = require('../../src/config/database');
  await require('../migrate-postgres.cjs')(pool);
  const bcrypt = require('bcrypt');
  const password = crypto.randomBytes(16).toString('hex');
  const users = {}, tokens = {};
  for (const role of ['admin','manager','employee']) {
    const [r] = await pool.query('INSERT INTO user(full_name,username,password_hash,auth_key,status) VALUES(?,?,?,?,?)',
      [`QA ${role}`,role,await bcrypt.hash(password,4),crypto.randomBytes(16).toString('hex'),'1']);
    users[role] = r.insertId;
    await pool.query("INSERT INTO user_role(user_id,role_id,status) SELECT ?,id,'active' FROM role WHERE code=?",[r.insertId,role]);
  }
  server = require('../../src/app').listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function req(role,path,body,status=200) {
    const response = await fetch(base+path,{method:path === '/auth/login' ? 'POST' : 'PATCH',
      headers:{'Content-Type':'application/json',...(tokens[role] ? {Authorization:`Bearer ${tokens[role]}`} : {})},body:JSON.stringify(body)});
    const data = await response.json();
    assert.equal(response.status,status,JSON.stringify(data));
    return data.payload;
  }
  for (const role of Object.keys(users)) tokens[role]=(await req(role,'/auth/login',{username:role,password})).accessToken;
  const mealIds=[];
  for (let day=2;day<=9;day++) {
    const [m]=await pool.query("INSERT INTO meal(meal_date,status,is_cancelled) VALUES(?,'active',?)",[`2098-11-0${day}`,day === 6 ? 1 : 0]);
    mealIds.push(m.insertId);
    if (day !== 9) await pool.query('INSERT INTO meal_registration(user_id,meal_id,guest_count,status) VALUES(?,?,?,?)',
      [users.employee,m.insertId,2,day === 8 ? 'confirmed' : 'cancelled']);
  }
  await pool.query("INSERT INTO holiday_event(name,from_date,to_date,status) VALUES('QA','2098-11-07','2098-11-07','active')");
  const [cut]=await pool.query("INSERT INTO meal_option(user_id,type,from_date,to_date,status) VALUES(?,'cancel_permanent','2098-11-02','9999-12-31','approved')",[users.employee]);
  const [other]=await pool.query("INSERT INTO meal_option(user_id,type,from_date,to_date,status) VALUES(?,'cancel_schedule','2098-11-05','2098-11-05','approved')",[users.employee]);
  const path=`/meal-options/${cut.insertId}/reactivate`;
  for (const role of ['manager','employee']) await req(role,path,{fromDate:'2098-11-04'},403);
  for (const date of ['2001-01-01','2098-02-30','not-a-date']) await req('admin',path,{fromDate:date},400);
  const restored=await req('admin',path,{fromDate:'2098-11-04'});
  assert.equal(restored.restoredCount,2); // 04 restored, 09 created. 05 cut, 06 cancelled kitchen, 07 holiday, 08 already registered.
  assert.equal(restored.option.toDate,'2098-11-03');
  const [rows]=await pool.query('SELECT m.meal_date,mr.status,mr.guest_count FROM meal_registration mr JOIN meal m ON m.id=mr.meal_id WHERE mr.user_id=? ORDER BY m.meal_date',[users.employee]);
  assert.deepEqual(rows.map(r=>r.status),['cancelled','cancelled','confirmed','cancelled','cancelled','cancelled','confirmed','confirmed']);
  assert.equal(rows[2].guest_count,0);
  assert.equal(rows[6].guest_count,2); // Existing active guest count untouched.
  await req('admin',path,{fromDate:'2098-11-04'},409);
  const second=await req('admin',`/meal-options/${other.insertId}/reactivate`,{fromDate:'2098-11-05'});
  assert.equal(second.restoredCount,1);
  assert.equal(second.option.status,'rejected'); // Entire future range ended without invalid date bounds.
  const [pending]=await pool.query("INSERT INTO meal_option(user_id,type,from_date,to_date,status) VALUES(?,'cancel_schedule','2098-12-01','2098-12-20','pending')",[users.employee]);
  await req('admin',`/meal-options/${pending.insertId}/reactivate`,{fromDate:'2098-12-01'},409);
  const [inactive]=await pool.query("INSERT INTO meal_option(user_id,type,from_date,to_date,status) VALUES(?,'cancel_schedule','2098-12-01','2098-12-20','approved')",[users.employee]);
  await pool.query("UPDATE user SET status='0' WHERE id=?",[users.employee]);
  await req('admin',`/meal-options/${inactive.insertId}/reactivate`,{fromDate:'2098-12-01'},409);
  console.log('PASS restore HTTP + PostgreSQL: authorization, dates, overlap, holiday, closed kitchen, existing guests, missing registration, repeat, pending and inactive user.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  if(pool) await pool.end();
  if(/^appmeal_restore_qa_\d+_\d+$/.test(schema)) await adminPool.native.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await adminPool.end();
});
