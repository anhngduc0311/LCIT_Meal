const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });
const { createPool } = require('../../src/config/postgres');
const url = new URL(process.env.DATABASE_URL);
url.hostname = url.hostname.replace('-pooler.', '.');
process.env.DATABASE_URL = url.toString();
const schema = `appmeal_pending_qa_${Date.now()}_${process.pid}`;
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
  for (const role of ['admin','employee','manager']) {
    const [r] = await pool.query('INSERT INTO user(full_name,username,password_hash,auth_key,status) VALUES(?,?,?,?,?)',
      [`QA ${role}`,role,await bcrypt.hash(password,4),crypto.randomBytes(16).toString('hex'),'1']);
    users[role] = r.insertId;
    await pool.query("INSERT INTO user_role(user_id,role_id,status) SELECT ?,id,'active' FROM role WHERE code=?",[r.insertId,role]);
  }
  server = require('../../src/app').listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function req(role,path,method,body) {
    const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(tokens[role] ? {Authorization:`Bearer ${tokens[role]}`} : {})},body:JSON.stringify(body)});
    return { status:response.status, data:await response.json() };
  }
  for(const role of Object.keys(users)) tokens[role]=(await req(role,'/auth/login','POST',{username:role,password})).data.payload.accessToken;
  const input={type:'cancel_schedule',fromDate:'2098-11-05',toDate:'2098-11-07'};
  const results=await Promise.all(Array.from({length:5},()=>req('employee','/meal-options','POST',input)));
  assert.equal(results.filter(r=>r.status===201).length,1);
  assert.equal(results.filter(r=>r.status===409).length,4);
  const first=results.find(r=>r.status===201).data.payload;
  assert.equal((await req('admin','/meal-options','POST',{...input,userId:users.employee,type:'cancel_permanent',toDate:'9999-12-31'})).status,409);
  assert.equal((await req('employee','/meal-options','POST',{...input,type:'cancel_today'})).status,409);
  // Different users do not block one another.
  assert.equal((await req('manager','/meal-options','POST',input)).status,201);
  assert.equal((await req('admin',`/meal-options/${first.id}/approve`,'PATCH',{})).status,200);
  const next=await req('employee','/meal-options','POST',input);
  assert.equal(next.status,201);
  assert.equal((await req('admin',`/meal-options/${next.data.payload.id}/reject`,'PATCH',{})).status,200);
  assert.equal((await req('employee','/meal-options','POST',input)).status,201);
  const [[count]]=await pool.query("SELECT COUNT(*) AS total FROM meal_option WHERE user_id=? AND status='pending'",[users.employee]);
  assert.equal(Number(count.total),1);
  console.log('PASS single-pending HTTP/PostgreSQL: five concurrent submissions, one insert, cross-type/on-behalf enforcement, independent users, approval and rejection unlock.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  if(pool) await pool.end();
  if(/^appmeal_pending_qa_\d+_\d+$/.test(schema)) await adminPool.native.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await adminPool.end();
});
