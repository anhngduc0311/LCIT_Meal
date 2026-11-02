const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });
const { createPool, compile } = require('../../src/config/postgres');
// Neon transaction pooling does not allow search_path startup overrides.
// Tests use the same branch's direct endpoint for isolated schemas.
const directUrl = new URL(process.env.DATABASE_URL);
directUrl.hostname = directUrl.hostname.replace('-pooler.', '.');
process.env.DATABASE_URL = directUrl.toString();
const schema = `appmeal_qa_${Date.now()}_${process.pid}`;
const adminPool = createPool(process.env.DATABASE_URL);
let pool, server;
let checks = 0;
async function main() {
  assert.deepEqual(compile("SELECT '?' AS literal FROM user WHERE id IN (?) AND username=?", [[1, 2], 'test']),
    { text: 'SELECT \'?\' AS literal FROM "user" WHERE id IN ($1,$2) AND username=$3', values: [1,2,'test'] });
  checks++;
  await adminPool.native.query(`CREATE SCHEMA ${schema}`);
  process.env.DATABASE_SCHEMA = schema;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  pool = require('../../src/config/database');
  await require('../migrate-postgres.cjs')(pool);
  const bcrypt = require('bcrypt');
  const password = crypto.randomBytes(16).toString('hex');
  const users = {};
  for (const role of ['admin','manager','employee','kitchen']) {
    const [user] = await pool.query('INSERT INTO user(full_name,username,password_hash,auth_key,status) VALUES(?,?,?,?,?)',
      [`QA ${role}`, role, await bcrypt.hash(password, 4), crypto.randomBytes(16).toString('hex'), '1']);
    await pool.query("INSERT INTO user_role(user_id,role_id,status) SELECT ?,id,'active' FROM role WHERE code=?", [user.insertId, role]);
    users[role] = user.insertId;
  }
  const app = require('../../src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokens = {};
  async function req(role, route, method = 'GET', body, status = 200) {
    const result = await fetch(`${base}/api${route}`, { method, headers: {
      'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const json = await result.json();
    assert.equal(result.status, status, `${method} ${route}: ${json.error?.message}`);
    checks++;
    return json.payload;
  }
  for (const role of Object.keys(users)) {
    const session = await req(role, '/auth/login', 'POST', { username: role, password });
    assert.ok(!('passwordHash' in session.user));
    tokens[role] = session.accessToken;
  }
  for (const route of ['/users','/roles','/meals','/meal-options','/meal-registrations','/payments','/notifications','/audit-logs','/system-settings']) await req('admin', route);
  await req('employee', '/users', 'GET', undefined, 403);
  await req('admin', '/users?query=QA');
  const date = '2098-11-03';
  const meal = await req('admin', '/meals', 'POST', { mealDate: date }, 201);
  await req('admin', '/meals', 'POST', { mealDate: date }, 409);
  const reg = await req('employee', '/meal-registrations', 'POST', { mealId: meal.id, guestCount: 2 }, 201);
  assert.equal(reg.mealDate, date);
  const dashboard = await req('admin', `/dashboard/home?date=${date}`);
  assert.equal(dashboard.todayStaff.total_meal_slots, 3);
  for (const period of ['week','month','year']) await req('admin', `/dashboard/chart?period=${period}&date=${date}`);
  const holiday = await req('admin', '/holiday-events', 'POST', { name: 'QA holiday', fromDate: date, toDate: date }, 201);
  assert.equal((await req('employee', `/meal-registrations/${reg.id}`)).status, 'cancelled');
  await req('admin', `/holiday-events/${holiday.id}/restore`, 'PATCH', {});
  assert.equal((await req('employee', `/meal-registrations/${reg.id}`)).status, 'confirmed');
  await req('manager', `/meal-registrations/${reg.id}/cancel`, 'PATCH', {});
  // Management can repeatedly correct historical/completed meals through HTTP.
  const [oldMeal] = await pool.query("INSERT INTO meal(meal_date,status) VALUES(?,'active')", ['2001-01-02']);
  for (const role of ['admin', 'manager']) {
    for (let round = 0; round < 2; round++) {
      const restored = await req(role, '/meal-registrations', 'POST', { userId: users.employee, mealId: oldMeal.insertId, guestCount: 1 }, 201);
      assert.equal(restored.status, 'completed');
      const cut = await req(role, `/meal-registrations/${restored.id}/cancel`, 'PATCH', {});
      assert.equal(cut.status, 'cancelled');
    }
  }
  await req('employee', '/meal-registrations', 'POST', { mealId: oldMeal.insertId }, 409);
  const payment = await req('manager', '/payments', 'POST', { userId: users.employee, paymentDate: date, amount: 90000 }, 201);
  assert.equal(payment.paymentDate, date);
  await req('manager', `/payments/${payment.id}/mark-paid`, 'PATCH', { paidAmount: 90000 });
  const accrued = await req('admin', '/meal-registrations', 'POST', { userId: users.employee, mealId: oldMeal.insertId, guestCount: 1 }, 201);
  const ledger = await req('employee', `/payments/me/ledger?userId=${users.manager}`);
  assert.match(ledger.currentMonth, /^\d{4}-\d{2}$/);
  assert.equal(ledger.totalUnpaidAmount, 60000);
  assert.equal(ledger.months.find(m => m.month === '2001-01').days[0].unpaidAmount, 60000);
  assert.equal((await req('manager', '/payments/me/ledger')).totalUnpaidAmount, 0);
  const bill = await req('manager', '/payments', 'POST', { userId: users.employee, paymentDate: '2001-01-31', amount: 60000 }, 201);
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 60000);
  await req('manager', `/payments/${bill.id}/mark-paid`, 'PATCH', { paidAmount: 60000 });
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 0);
  await req('admin', `/meal-registrations/${accrued.id}/cancel`, 'PATCH', {});
  await Promise.all([
    req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 2 }),
    req('manager', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 3 }),
  ]);
  await req('manager', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 2, count: 4 });
  const guests = await req('admin', '/meals/guests?from=2001-01-02&to=2001-01-02');
  assert.equal(guests.find(g => g.facilityId === 1).guestCount, 5);
  assert.equal(guests.find(g => g.facilityId === 2).guestCount, 4);
  const kitchenTotals = await req('kitchen', '/dashboard/home?date=2001-01-02');
  assert.equal(kitchenTotals.todayStaff.total_guest_count, 9);
  assert.equal(kitchenTotals.todayStaff.total_meal_slots, 9);
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 0);
  const guestChart = await req('admin', '/dashboard/chart?period=month&date=2001-01-02');
  assert.equal(guestChart.data.find(row => row.meal_date === '2001-01-02').total_meal_slots, 9);
  const guestYear = await req('admin', '/dashboard/chart?period=year&date=2001-01-02');
  assert.equal(guestYear.data.find(row => row.meal_date === '2001-01').total_meal_slots, 9);
  const guestSummary = await req('admin', `/meals/${oldMeal.insertId}/summary`);
  assert.equal(guestSummary.registeredCount, 0);
  assert.equal(guestSummary.guestCountTotal, 9);
  await req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 3, count: 1 }, 400);
  await req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 0 }, 400);
  await req('employee', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 1 }, 403);
  await pool.query('UPDATE meal SET is_cancelled=1 WHERE id=?', [oldMeal.insertId]);
  await req('manager', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 1 }, 409);
  assert.equal((await req('admin', '/meals/guests?from=2001-01-02&to=2001-01-02')).length, 0);
  await req('employee', '/notifications/me');
  await req('employee', '/notifications/me/seen-all', 'PATCH', {});
  const dayRepo = new (require('../../src/repos/MealScheduleConfigRepository'))();
  await dayRepo.upsert(1, true, 'QA test', users.admin);
  assert.equal((await dayRepo.getEnabledDays()).includes(1), true);
  checks++;
  const regRepo = new (require('../../src/repos/MealRegistrationRepository'))();
  assert.equal(await regRepo.completeConfirmedByDate(date), 0);
  checks++;
  const tx = await pool.getConnection();
  await tx.beginTransaction();
  await tx.query("UPDATE system_setting SET setting_value='999' WHERE setting_key='meal_price'");
  await tx.rollback(); tx.release();
  const [[setting]] = await pool.query("SELECT setting_value FROM system_setting WHERE setting_key='meal_price'");
  assert.equal(setting.setting_value, '30000'); checks++;
  assert.equal((await fetch(`${base}/healthz`)).status, 200); checks++;
  await req('admin','/auth/logout','POST',{});
  await req('admin','/users','GET',undefined,401);
  console.log(`PASS ${checks} PostgreSQL checks (isolated schema).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  // Only this run's generated, non-production test schema is removed.
  if (/^appmeal_qa_\d+_\d+$/.test(schema)) await adminPool.native.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await adminPool.end();
});
