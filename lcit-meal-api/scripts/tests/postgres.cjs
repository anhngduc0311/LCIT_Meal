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
  process.env.SSO_ENABLED = 'false';
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
  assert.equal((await req(null, '/auth/sso/config')).enabled, false);
  await req(null, '/auth/sso/start', 'GET', undefined, 503);
  for (const role of ['employee', 'manager', 'admin']) {
    const window = await req(role, '/meal-registrations/window');
    assert.match(window.today, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(window.targetDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['open', 'late'].includes(window.targetState));
  }
  await req('kitchen', '/meal-registrations/window', 'GET', undefined, 403);
  await req('employee', '/meal-registrations/not-an-id', 'GET', undefined, 400);
  for (const route of ['/users','/roles','/meals','/meal-options','/meal-registrations','/payments','/notifications','/audit-logs','/system-settings']) await req('admin', route);
  await req('employee', '/users', 'GET', undefined, 403);
  await req('admin', '/users?query=QA');
  // Phone storage is admin-managed; old clients and self-profile edits preserve it.
  const phoneUser = await req('admin', '/users', 'POST', {
    fullName: 'QA Phone', username: 'qa_phone', password, phone: '+84 90 123 4567',
  }, 201);
  assert.equal(phoneUser.phone, '0901234567');
  assert.equal((await req('admin', `/users/${phoneUser.id}`)).phone, '0901234567');
  await req('admin', '/users', 'POST', {
    fullName: 'QA Duplicate', username: 'qa_duplicate_phone', password, phone: '0901234567',
  }, 409);
  await req('admin', `/users/${phoneUser.id}`, 'PUT', { phone: 'invalid' }, 400);
  assert.equal((await req('admin', `/users/${phoneUser.id}`, 'PUT', { fullName: 'QA Phone Updated' })).phone, '0901234567');
  await req('manager', `/users/${phoneUser.id}`, 'PUT', { phone: '0909999999' }, 403);
  await req('admin', `/users/${users.employee}`, 'PUT', { phone: '0912345678' });
  const ownProfile = await req('employee', '/users/me', 'PATCH', {
    fullName: 'QA employee', phone: '+84 90 999 9999', username: 'admin', roleId: 1, status: '0',
  });
  assert.equal(ownProfile.phone, '0909999999');
  assert.equal(ownProfile.username, 'employee');
  assert.equal(ownProfile.status, '1');
  assert.deepEqual(ownProfile.roles.map(role => role.code), ['employee']);
  assert.equal((await req('admin', `/users/${users.employee}`)).phone, '0909999999');
  await req('employee', '/users/me', 'PATCH', { phone: '0901234567' }, 409);
  await req('employee', '/users/me', 'PATCH', { phone: 'invalid' }, 400);
  assert.equal((await req('employee', '/users/me', 'PATCH', { fullName: 'QA employee' })).phone, '0909999999');
  assert.equal((await req('employee', '/users/me', 'PATCH', { phone: '' })).phone, null);
  await req('employee', '/users/me', 'PATCH', { phone: '0912345678' });
  const auth = new (require('../../src/services/AuthService'))(new (require('../../src/repos/UserRepository'))(), {});
  assert.equal((await auth.resolveSsoUser('+84 912 345 678')).id, users.employee);
  await assert.rejects(auth.resolveSsoUser('0909999999'), { statusCode: 403 });
  assert.equal((await req('admin', `/users/${phoneUser.id}`, 'PUT', { phone: '' })).phone, null);
  const batch = await req('admin', '/users/batch', 'POST', { users: [{
    fullName: 'QA Batch Phone', username: 'qa_batch_phone', password, phone: '0084902222222',
  }] }, 201);
  assert.equal(batch.users[0].phone, '0902222222');
  checks += 8;
  const date = '2098-11-03';
  const meal = await req('admin', '/meals', 'POST', { mealDate: date }, 201);
  await req('admin', '/meals', 'POST', { mealDate: date }, 409);
  const reg = await req('employee', '/meal-registrations', 'POST', { mealId: meal.id, guestCount: 2 }, 201);
  assert.equal(reg.mealDate, date);
  const dashboard = await req('admin', `/dashboard/home?date=${date}`);
  assert.equal(dashboard.todayStaff.total_meal_slots, 3);
  assert.equal((await req('admin', `/dashboard/home?date=${date}&facilityId=1`)).todayStaff.total_meal_slots, 0);
  await pool.query('UPDATE user SET facility_id=1 WHERE id=?', [users.employee]);
  const siteOneHome = await req('admin', `/dashboard/home?date=${date}&facilityId=1`);
  assert.equal(siteOneHome.todayStaff.registered_staff_count, 1);
  assert.equal(siteOneHome.todayStaff.total_guest_count, 2);
  assert.equal(siteOneHome.todayMeal.total_meal_slots, 3);
  assert.equal((await req('admin', `/dashboard/home?date=${date}&facilityId=2`)).todayStaff.total_meal_slots, 0);
  assert.equal((await req('kitchen', `/dashboard/home?date=${date}&facilityId=2`)).todayStaff.total_meal_slots, 3);
  await req('admin', '/dashboard/home?facilityId=invalid', 'GET', undefined, 400);
  for (const period of ['week','month','year']) await req('admin', `/dashboard/chart?period=${period}&date=${date}`);
  const holiday = await req('admin', '/holiday-events', 'POST', { name: 'QA holiday', fromDate: date, toDate: date }, 201);
  assert.equal((await req('employee', `/meal-registrations/${reg.id}`)).status, 'cancelled');
  await req('admin', `/holiday-events/${holiday.id}/restore`, 'PATCH', {});
  assert.equal((await req('employee', `/meal-registrations/${reg.id}`)).status, 'confirmed');
  await req('manager', `/meal-registrations/${reg.id}/cancel`, 'PATCH', {});
  // Only administrators can correct historical meals after the manager deadline.
  const [oldMeal] = await pool.query("INSERT INTO meal(meal_date,status) VALUES(?,'active')", ['2001-01-02']);
  for (const role of ['admin']) {
    for (let round = 0; round < 2; round++) {
      const restored = await req(role, '/meal-registrations', 'POST', { userId: users.employee, mealId: oldMeal.insertId, guestCount: 1 }, 201);
      assert.equal(restored.status, 'completed');
      const cut = await req(role, `/meal-registrations/${restored.id}/cancel`, 'PATCH', {});
      assert.equal(cut.status, 'cancelled');
    }
  }
  await req('manager', '/meal-registrations', 'POST', { userId: users.employee, mealId: oldMeal.insertId }, 409);
  await req('manager', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 1 }, 409);
  await req('manager', `/meals/${oldMeal.insertId}/guests/remove`, 'PATCH', { facilityId: 1, count: 1 }, 409);
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
  // Opening personal payments automatically materializes a closed month's bill.
  const automatic = await req('employee', '/payments/me');
  const bill = automatic.find(p => p.paymentDate === '2001-01-31');
  assert.ok(bill);
  assert.equal(bill.amount, 60000);
  assert.equal(automatic.filter(p => p.paymentDate === '2001-01-31').length, 1); checks++;
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 60000);
  await req('manager', `/payments/${bill.id}/mark-paid`, 'PATCH', { paidAmount: 60000 });
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 0);
  await req('admin', `/meal-registrations/${accrued.id}/cancel`, 'PATCH', {});
  await Promise.all([
    req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 2 }),
    req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 3 }),
  ]);
  await req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 2, count: 4 });
  const guests = await req('admin', '/meals/guests?from=2001-01-02&to=2001-01-02');
  assert.equal(guests.find(g => g.facilityId === 1).guestCount, 5);
  assert.equal(guests.find(g => g.facilityId === 2).guestCount, 4);
  const historicalSiteOne = await req('admin', '/dashboard/home?date=2001-01-02&facilityId=1');
  assert.equal(historicalSiteOne.todayMeal.total_meal_slots, 5);
  assert.equal(historicalSiteOne.todayStaff.total_guest_count, 5);
  assert.equal(historicalSiteOne.weeklyChart.reduce((sum, point) => sum + Number(point.total_meal_slots), 0), 5);
  const kitchenTotals = await req('kitchen', '/dashboard/home?date=2001-01-02');
  assert.equal(kitchenTotals.todayStaff.total_guest_count, 5);
  assert.equal(kitchenTotals.todayStaff.total_meal_slots, 5);
  assert.equal((await req('employee', '/payments/me/ledger')).totalUnpaidAmount, 0);
  const guestChart = await req('admin', '/dashboard/chart?period=month&date=2001-01-02');
  assert.equal(guestChart.data.find(row => row.meal_date === '2001-01-02').total_meal_slots, 9);
  const guestYear = await req('admin', '/dashboard/chart?period=year&date=2001-01-02');
  assert.equal(guestYear.data.find(row => row.meal_date === '2001-01').total_meal_slots, 9);
  const guestSummary = await req('admin', `/meals/${oldMeal.insertId}/summary`);
  assert.equal(guestSummary.registeredCount, 0);
  assert.equal(guestSummary.guestCountTotal, 5);
  const kitchenBoard = await req('kitchen', '/payments/monthly-board?month=2001-01');
  assert.equal(kitchenBoard.users.some(u => u.id === users.employee), true);
  assert.deepEqual(Object.keys(kitchenBoard.users[0]).sort(), ['facilityId', 'fullName', 'id', 'username']);
  assert.equal(kitchenBoard.settings.every(s => ['meal_price', 'guest_meal_price'].includes(s.settingKey)), true);
  assert.equal(kitchenBoard.guests.reduce((sum, g) => sum + g.guestCount, 0), 9); checks++;
  await req('employee', '/payments/monthly-board?month=2001-01', 'GET', undefined, 403);
  await req('kitchen', '/payments/monthly-board?month=invalid', 'GET', undefined, 400);
  await req('kitchen', '/payments/filter');
  await req('kitchen', '/users', 'GET', undefined, 403);
  await req('kitchen', '/system-settings', 'GET', undefined, 403);
  await req('kitchen', '/payments', 'POST', { userId: users.employee, paymentDate: date, amount: 1 }, 403);
  await req('kitchen', `/payments/${bill.id}`, 'PUT', { amount: 1 }, 403);
  await req('kitchen', `/payments/${bill.id}`, 'DELETE', undefined, 403);
  const kitchenConfirmBill = await req('admin', '/payments', 'POST', { userId: users.manager, paymentDate: '2096-01-31', amount: 1000 }, 201);
  await req('kitchen', `/payments/${kitchenConfirmBill.id}/mark-paid`, 'PATCH', { paidAmount: 1000 });
  await req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 3, count: 1 }, 400);
  await req('admin', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 0 }, 400);
  await req('employee', `/meals/${oldMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 1 }, 403);
  const removeRoute = `/meals/${oldMeal.insertId}/guests/remove`;
  await req('employee', removeRoute, 'PATCH', { facilityId: 1, count: 1 }, 403);
  await req('kitchen', removeRoute, 'PATCH', { facilityId: 1, count: 1 }, 403);
  for (const count of [0, -1, 1.5, 1001]) {
    await req('admin', removeRoute, 'PATCH', { facilityId: 1, count }, 400);
  }
  await req('admin', removeRoute, 'PATCH', { facilityId: 3, count: 1 }, 400);
  assert.equal((await req('admin', removeRoute, 'PATCH', { facilityId: 1, count: 2 })).guestCount, 3);
  await req('admin', removeRoute, 'PATCH', { facilityId: 1, count: 4 }, 409);
  const concurrentCuts = await Promise.all([1, 2].map(() => fetch(`${base}/api${removeRoute}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
    body: JSON.stringify({ facilityId: 1, count: 2 }),
  })));
  assert.deepEqual(concurrentCuts.map(response => response.status).sort(), [200, 409]); checks++;
  assert.equal((await req('admin', removeRoute, 'PATCH', { facilityId: 1, count: 1 })).guestCount, 0);
  const remainingGuests = await req('admin', '/meals/guests?from=2001-01-02&to=2001-01-02');
  assert.equal(remainingGuests.find(g => g.facilityId === 1).guestCount, 0);
  assert.equal(remainingGuests.find(g => g.facilityId === 2).guestCount, 4);
  assert.equal((await req('kitchen', '/dashboard/home?date=2001-01-02')).todayStaff.total_meal_slots, 0);
  await pool.query('UPDATE meal SET is_cancelled=1 WHERE id=?', [oldMeal.insertId]);
  await req('manager', removeRoute, 'PATCH', { facilityId: 2, count: 1 }, 409);
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
  const billingRepo = new (require('../../src/repos/PaymentRepository'))();
  const [monthEndMeal] = await pool.query("INSERT INTO meal(meal_date,status) VALUES(?,'active')", ['2097-11-30']);
  await pool.query("INSERT INTO meal_registration(user_id,meal_id,guest_count,status) VALUES(?,?,2,'confirmed')", [users.employee, monthEndMeal.insertId]);
  await req('manager', `/meals/${monthEndMeal.insertId}/guests`, 'PATCH', { facilityId: 1, count: 10 });
  await billingRepo.generateMonthlyPayments('2097-11-30', '11:59', users.employee);
  const [notDue] = await pool.query('SELECT id FROM payment WHERE user_id=? AND payment_date=?', [users.employee, '2097-11-30']);
  assert.equal(notDue.length, 0); checks++;
  const generated = await Promise.all([1, 2].map(() => billingRepo.generateMonthlyPayments('2097-11-30', '12:00', users.employee)));
  assert.equal(generated.reduce((sum, item) => sum + item.created, 0), 1); checks++;
  const [monthBills] = await pool.query('SELECT amount,is_paid FROM payment WHERE user_id=? AND payment_date=?', [users.employee, '2097-11-30']);
  assert.equal(monthBills.length, 1);
  assert.equal(Number(monthBills[0].amount), 90000); // 1 staff + 2 linked guests; 10 facility guests remain separate.
  assert.equal(Number(monthBills[0].is_paid), 0); checks++;
  assert.equal((await billingRepo.generateMonthlyPayments('2097-12-01', '08:00', users.employee)).created, 0); checks++;
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
