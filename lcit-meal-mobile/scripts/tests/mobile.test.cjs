const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const { createTestApp } = require('./load-source.cjs');
let app, client, keys;
const originalFetch = global.fetch;
beforeEach(() => {
  app = createTestApp();
  client = app.load('services/apiClient.ts');
  keys = app.load('config/constants.ts').STORAGE_KEYS;
});
afterEach(() => { global.fetch = originalFetch; client.registerUnauthorizedCallback(null); });
const respond = (status, body) => new Response(JSON.stringify(body), { status });
test('Business dates retain calendar date across timezones and year boundaries', () => {
  const f = app.load('utils/formatters.ts');
  for (const date of ['2026-12-31', '2027-01-01', '2028-02-29']) {
    assert.equal(f.formatBusinessDate(`${date}T00:00:00.000Z`), date);
    assert.equal(f.formatBusinessDate(`${date}T23:59:59-07:00`), date);
  }
  assert.equal(f.formatDisplayDate('2026-10-15'), '15/10/2026');
  assert.equal(f.getFullDayOfWeek('2026-10-15'), 'Thứ Năm');
  assert.equal(f.formatBusinessDate('invalid'), '');
  assert.equal(f.formatDisplayDate(null), '');
});

test('Monthly meal table handles leap years, cancelled days, guests and completed meals', () => {
  const m = app.load('utils/monthlyMeals.ts');
  assert.equal(m.monthRange('2028-02').dates.length, 29);
  assert.equal(m.shiftMonth('2026-12', 1), '2027-01');
  assert.throws(() => m.monthRange('2026-13'));
  const table = m.buildMonthlyMeals('2026-11', [
    { userId: 1, mealDate: '2026-11-02', status: 'confirmed', guestCount: 2 },
    { userId: 1, mealDate: '2026-11-03', status: 'completed', guestCount: 0 },
    { userId: 1, mealDate: '2026-11-04', status: 'confirmed', guestCount: 3 },
    { userId: 2, mealDate: '2026-11-02', status: 'cancelled', guestCount: 0 },
    { userId: 2, mealDate: '2026-11-03', status: 'pending', guestCount: 4 },
    { userId: 99, mealDate: '2026-11-02', status: 'confirmed', guestCount: 0 },
    { userId: 1, mealDate: '2026-12-01', status: 'confirmed', guestCount: 0 },
  ], [
    { mealDate: '2026-11-02', status: 'active', isCancelled: false },
    { mealDate: '2026-11-03', status: 'active', isCancelled: false },
    { mealDate: '2026-11-04', status: 'active', isCancelled: true },
  ], [1, 2], 30000, 40000);
  assert.equal(table.total, 4);
  assert.equal(table.completed, 1);
  assert.equal(table.amount, 140000);
  assert.deepEqual(table.days.get('2026-11-02'), { staff: 1, guests: 2, total: 3 });
  assert.equal(table.people.get(2).staff, 0);
  assert.equal(table.cells.get('2026-11-02:2').status, 'cancelled');
});

test('Monthly payment status distinguishes no invoice, partly paid and fully paid', () => {
  const m = app.load('utils/monthlyMeals.ts');
  assert.equal(m.monthlyPaymentState([], 1, '2026-11').label, 'Chưa lập');
  const invoices = [
    { userId: 1, paymentDate: '2026-11-01', isPaid: false, status: 'unpaid' },
    { userId: 1, paymentDate: '2026-11-02', isPaid: true, status: 'paid' },
    { userId: 2, paymentDate: '2026-11-01', isPaid: true, status: 'paid' },
  ];
  assert.equal(m.monthlyPaymentState(invoices, 1, '2026-11').paid, false);
  assert.equal(m.monthlyPaymentState(invoices, 2, '2026-11').paid, true);
  assert.equal(m.monthlyPaymentState(invoices, 1, '2026-12').label, 'Chưa lập');
});

test('Cancellation closes exactly at 08:00 Vietnam time, independently of device timezone', () => {
  const deadline = app.load('utils/cancellationDeadline.ts');
  assert.equal(deadline.isCancellationClosed('2026-10-23', Date.parse('2026-10-23T00:59:59.999Z')), false);
  assert.equal(deadline.isCancellationClosed('2026-10-23', Date.parse('2026-10-23T01:00:00Z')), true);
  assert.equal(deadline.isCancellationClosed('2026-10-23', Date.parse('2026-10-23T08:00:00Z')), true);
  assert.equal(deadline.isCancellationClosed('2026-10-24', Date.parse('2026-10-23T08:00:00Z')), false);
  assert.equal(deadline.isCancellationClosed('2026-10-22', Date.parse('2026-10-23T00:00:00Z')), true);
  assert.equal(deadline.isCancellationClosed(undefined), true);
  assert.equal(deadline.vietnamToday(Date.parse('2026-12-31T18:00:00Z')), '2027-01-01');
  assert.equal(deadline.nextCancellationClockChange(Date.parse('2026-10-23T00:59:59Z')), Date.parse('2026-10-23T01:00:00Z'));
  assert.equal(deadline.nextCancellationClockChange(Date.parse('2026-10-23T01:00:00Z')), Date.parse('2026-10-23T17:00:00Z'));
});

test('Cancellation service rechecks cutoff after reading the meal, so an old dialog cannot submit late', async () => {
  const { mealService } = app.load('services/mealService.ts');
  const originalNow = Date.now;
  let now = Date.parse('2026-10-23T00:59:59Z');
  Date.now = () => now;
  const writes = [];
  global.fetch = async (url, config) => {
    if (!config.method || config.method === 'GET') {
      now = Date.parse('2026-10-23T01:00:00Z');
      return respond(200, { success: true, payload: { id: 1, mealDate: '2026-10-23' } });
    }
    writes.push(url);
    return respond(200, { success: true, payload: { id: 1 } });
  };
  try {
    await assert.rejects(mealService.cancelRegistration(1), /Đã quá hạn cắt suất/);
    assert.equal(writes.length, 0);
  } finally { Date.now = originalNow; }
});

test('Management cancellation delegates to server permission checks after the personal cutoff', async () => {
  const { mealService } = app.load('services/mealService.ts');
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-10-23T03:00:00Z');
  const calls = [];
  global.fetch = async (url, config) => {
    calls.push({ url, method: config.method });
    return respond(200, { success: true, payload: { id: 42, status: 'cancelled' } });
  };
  try {
    const result = await mealService.cancelRegistrationOnBehalf(42);
    assert.equal(result.status, 'cancelled');
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/meal-registrations\/42\/cancel$/);
    assert.equal(calls[0].method, 'PATCH');
    global.fetch = async () => respond(409, { success: false, error: { code: 409, message: 'Suất ăn đã hoàn thành' } });
    await assert.rejects(mealService.cancelRegistrationOnBehalf(42), /Suất ăn đã hoàn thành/);
    global.fetch = async () => respond(403, { success: false, error: { code: 403, message: 'Không có quyền thao tác' } });
    await assert.rejects(mealService.cancelRegistrationOnBehalf(42), /Không có quyền thao tác/);
  } finally { Date.now = originalNow; }
});

test('Cancellation is submitted before cutoff, while future meals remain available after cutoff', async () => {
  const { mealService } = app.load('services/mealService.ts');
  const originalNow = Date.now;
  let now = Date.parse('2026-10-23T00:59:59Z');
  let day = '2026-10-23';
  Date.now = () => now;
  const methods = [];
  global.fetch = async (_url, config) => {
    methods.push(config.method || 'GET');
    return respond(200, { success: true, payload: { id: 1, mealDate: day, status: 'cancelled' } });
  };
  try {
    await mealService.cancelRegistration(1);
    assert.deepEqual(methods, ['GET', 'PATCH']);
    methods.length = 0;
    now = Date.parse('2026-10-23T02:00:00Z');
    day = '2026-10-24';
    await mealService.cancelRegistration(1);
    assert.deepEqual(methods, ['GET', 'PATCH']);
  } finally { Date.now = originalNow; }
});

test('Today, range and permanent cancellation requests cannot include a locked day', async () => {
  const { mealService } = app.load('services/mealService.ts');
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-10-23T01:00:00Z');
  const writes = [];
  global.fetch = async (url) => {
    writes.push(url);
    return respond(200, { success: true, payload: { id: 1 } });
  };
  try {
    for (const type of ['cancel_today', 'cancel_schedule', 'cancel_permanent']) {
      await assert.rejects(mealService.createMealOption({ type, fromDate: '2026-10-23', toDate: '2026-10-25' }), /Đã quá hạn cắt suất/);
    }
    await assert.rejects(mealService.createMealOption({ type: 'cancel_today', fromDate: '2026-10-24', toDate: '2026-10-24' }), /Đã quá hạn cắt suất/);
    assert.equal(writes.length, 0);
    await mealService.createMealOption({ type: 'cancel_schedule', fromDate: '2026-10-24', toDate: '2026-10-25' });
    assert.equal(writes.length, 1);
  } finally { Date.now = originalNow; }
});
test('Role normalization handles backend objects, strings and role priority', () => {
  const { extractUserRole } = app.load('types/auth.ts');
  assert.equal(extractUserRole({ roles: [{ code: 'employee' }, { code: 'admin' }] }), 'admin');
  assert.equal(extractUserRole({ roles: ['employee', 'manager'] }), 'manager');
  assert.equal(extractUserRole({ roles: ['kitchen'] }), 'kitchen');
  assert.equal(extractUserRole({ role: 'manager', roles: ['employee'] }), 'manager');
});

test('Facility roster handles confirmed aliases without guessing other people or site 2', () => {
  const f = app.load('utils/facilities.ts');
  for (const fullName of ['Kim Mạnh Cường', 'Nguyễn T.Minh Phương', 'Nguyễn Đức Anh', 'Đàm Phan Hạnh']) {
    assert.equal(f.getFacility({ fullName: fullName.normalize('NFD') }), 1);
  }
  assert.equal(f.getFacility({ fullName: 'Hoàng Minh Tuân' }), 1);
  assert.equal(f.getFacility({ fullName: 'Bùi Thị Hải Hà (còi)' }), 1);
  assert.equal(f.getFacility({ fullName: 'Người khác' }), null);
  assert.equal(f.getFacility({ fullName: 'Quản lý bếp Cơ sở 1', facilityId: 1 }), 1);
  assert.equal(f.getFacility({ id: 2, fullName: 'Kim Mạnh Cường' }, { 2: { name: 'Kim Mạnh Cường', facilityId: 2 } }), 2);
  assert.equal(f.getFacility({ id: 2, fullName: 'Kim Mạnh Cường' }, { 2: { name: 'Kim Mạnh Cường', facilityId: null } }), null);
  assert.equal(f.getFacility({ id: 2, fullName: 'Người mới' }, { 2: { name: 'Người cũ', facilityId: 2 } }), null);
  assert.equal(f.matchesFacility(null, 'unassigned'), true);
  assert.equal(f.matchesFacility(null, 2), false);
});

test('Facility totals exclude cancelled and pending meals and include guests at the host site', () => {
  const f = app.load('utils/facilities.ts');
  const users = [{ id: 1, fullName: 'Kim Mạnh Cường' }, { id: 2, fullName: 'Test' }];
  const overrides = { 2: { name: 'Test', facilityId: 2 } };
  const result = f.summarizeFacilityMeals([
    { userId: 1, status: 'confirmed', guestCount: 2 },
    { userId: 2, status: 'completed', guestCount: 1 },
    { userId: 1, status: 'cancelled', guestCount: 4 },
    { userId: 1, status: 'pending', guestCount: 5 },
    { userId: 3, userName: 'Unknown', status: 'confirmed', guestCount: 0 },
  ], users, overrides);
  assert.deepEqual(result[1], { staff: 1, guests: 2, total: 3 });
  assert.deepEqual(result[2], { staff: 1, guests: 1, total: 2 });
  assert.deepEqual(result.unassigned, { staff: 1, guests: 0, total: 1 });
});

test('Local facility changes persist without HTTP writes and are isolated by API and mock mode', async () => {
  const { facilityService } = app.load('services/facilityService.ts');
  global.fetch = async () => { throw new Error('No network request expected'); };
  const person = { id: 2, fullName: 'Kim Mạnh Cường' };
  await facilityService.assign(person, 2);
  assert.equal((await facilityService.load())[2].facilityId, 2);
  assert.deepEqual(await facilityService.load(true), {});
  await app.storage.setItem(keys.API_URL_OVERRIDE, 'https://another.example/api');
  assert.deepEqual(await facilityService.load(), {});
  await app.storage.removeItem(keys.API_URL_OVERRIDE);
  await facilityService.assign(person, null);
  assert.equal((await facilityService.load())[2].facilityId, null);
  await assert.rejects(facilityService.assign({ id: 3 }, 1));
});
test('API normalizes override URL, attaches bearer token and unwraps payload', async () => {
  await app.storage.setItem(keys.API_URL_OVERRIDE, 'http://localhost:3000///');
  await app.storage.setItem(keys.AUTH_TOKEN, 'test-token');
  global.fetch = async (url, config) => {
    assert.equal(url, 'http://localhost:3000/api/meals');
    assert.equal(config.headers.Authorization, 'Bearer test-token');
    return respond(200, { success: true, payload: [{ id: 1 }] });
  };
  assert.deepEqual(await client.apiClient('meals'), [{ id: 1 }]);
});
test('Login 401 preserves server message without expiring another session', async () => {
  let called = false;
  client.registerUnauthorizedCallback(() => { called = true; });
  global.fetch = async (_url, config) => {
    assert.equal(config.headers.Authorization, undefined);
    return respond(401, { success: false, error: { code: 401, message: 'Sai mật khẩu' } });
  };
  await assert.rejects(client.apiClient('/auth/login', { skipAuth: true }), { code: 401, message: 'Sai mật khẩu' });
  assert.equal(called, false);
});
test('Protected 401 invokes session expiry callback', async () => {
  let called = 0;
  client.registerUnauthorizedCallback(() => { called++; });
  global.fetch = async () => respond(401, { success: false });
  await assert.rejects(client.apiClient('/meals'), { code: 401 });
  assert.equal(called, 1);
});
for (const status of [403, 409, 500]) {
  test(`API preserves server error ${status}`, async () => {
    global.fetch = async () => respond(status, { success: false, error: { code: status, message: 'Server error' } });
    await assert.rejects(client.apiClient('/meals'), { code: status, message: 'Server error' });
  });
}
test('Network failure reports connection error', async () => {
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(client.apiClient('/meals'), { code: 0 });
});
test('Request timeout aborts fetch and reports 408', async () => {
  global.fetch = (_url, config) => new Promise((_resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(client.apiClient('/meals', { timeoutMs: 10 }), { code: 408 });
});
test('Non-JSON server failure retains HTTP status', async () => {
  global.fetch = async () => new Response('<html>Error</html>', { status: 502 });
  await assert.rejects(client.apiClient('/meals'), { code: 502 });
});
test('Timeout covers reading the response body, not only response headers', async () => {
  global.fetch = async (_url, config) => ({
    status: 200, ok: true,
    json: () => new Promise((_resolve, reject) => {
      config.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });
  await assert.rejects(client.apiClient('/meals', { timeoutMs: 10 }), { code: 408 });
});
for (const body of ['<html>Proxy error</html>', 'null', '{}']) {
  test(`Malformed successful response is reported as server error: ${body}`, async () => {
    global.fetch = async () => new Response(body, { status: 200 });
    await assert.rejects(client.apiClient('/meals'), { code: 502 });
  });
}
test('Empty 204 response is accepted', async () => {
  global.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await client.apiClient('/meals/1', { method: 'DELETE' }), null);
});
test('FormData leaves multipart boundary to fetch', async () => {
  global.fetch = async (_url, config) => {
    assert.equal(config.headers['Content-Type'], undefined);
    return respond(200, { success: true, payload: { uploaded: true } });
  };
  await client.apiClient('/upload', { method: 'POST', body: new FormData() });
});
test('Lists support arrays, pagination and missing payloads', () => {
  assert.deepEqual(client.extractDataList([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(client.extractDataList({ data: [{ id: 2 }] }), [{ id: 2 }]);
  for (const value of [null, undefined, {}, { data: null }]) assert.deepEqual(client.extractDataList(value), []);
});
test('Auth service persists normalized login and clears session even offline', async () => {
  const { authService } = app.load('services/authService.ts');
  global.fetch = async (_url, config) => {
    assert.deepEqual(JSON.parse(config.body), { username: 'user1', password: '123456' });
    return respond(200, { success: true, payload: { accessToken: 'session', user: { id: 1, roles: [{ code: 'employee' }] } } });
  };
  assert.equal((await authService.login({ username: ' user1 ', password: '123456' })).user.role, 'employee');
  assert.equal((await authService.getStoredSession()).token, 'session');
  global.fetch = async () => { throw new TypeError('offline'); };
  await authService.logout();
  assert.deepEqual(await authService.getStoredSession(), { user: null, token: null });
});
test('Mock store preserves registration ID and waits for cancellation approval', () => {
  const { mockStore } = app.load('services/mockStore.ts');
  const meal = mockStore.createMeal('2099-01-15', 'Test');
  const reg = mockStore.registerMeal(meal.id, 2);
  const option = mockStore.createMealOption('cancel_schedule', meal.mealDate, meal.mealDate);
  assert.equal(option.status, 'pending');
  assert.equal(mockStore.getMyRegistrations().find(r => r.id === reg.id).status, 'confirmed');
  assert.equal(mockStore.approveMealOption(option.id).status, 'approved');
  assert.equal(mockStore.getMyRegistrations().find(r => r.id === reg.id).status, 'cancelled');
  const again = mockStore.registerMeal(meal.id, 0);
  assert.equal(again.id, reg.id);
  assert.equal(again.status, 'confirmed');
});

test('Only pending range and permanent cancellations need approval; daily cuts never enter the queue', () => {
  const { pendingCancellationRequests } = app.load('utils/cancellationRequests.ts');
  const options = [
    { id: 1, type: 'cancel_today', status: 'pending', createdAt: '2026-11-01' },
    { id: 2, type: 'cancel_schedule', status: 'pending', createdAt: '2026-11-02' },
    { id: 3, type: 'cancel_permanent', status: 'pending', createdAt: '2026-11-01' },
    { id: 4, type: 'cancel_schedule', status: 'approved' },
    { id: 5, type: 'cancel_permanent', status: 'rejected' },
  ];
  assert.deepEqual([...pendingCancellationRequests(options)].map(item => item.id), [3, 2]);
  assert.equal(options[0].id, 1);
});

test('Standalone guests count by facility/day without adding staff or personal charges', () => {
  const { buildMonthlyMeals } = app.load('utils/monthlyMeals.ts');
  const { summarizeFacilityMeals } = app.load('utils/facilities.ts');
  const meals = [{ id: 1, mealDate: '2026-11-02', status: 'active', completionStatus: 'completed' }];
  const guests = [{ mealId: 1, mealDate: '2026-11-02', facilityId: 1, guestCount: 3 }];
  const table = buildMonthlyMeals('2026-11', [], meals, [], 30000, 30000, guests);
  assert.equal(table.days.get('2026-11-02').staff, 0);
  assert.equal(table.days.get('2026-11-02').guests, 3);
  assert.equal(table.total, 3);
  assert.equal(table.amount, 90000);
  assert.equal(table.completed, 3);
  assert.equal(table.people.size, 0);
  assert.equal(summarizeFacilityMeals([], [], {}, guests)[1].total, 3);
  assert.equal(summarizeFacilityMeals([], [], {}, guests)[2].total, 0);
  assert.equal(buildMonthlyMeals('2026-11', [], [{ ...meals[0], isCancelled: true }], [], 30000, 30000, guests).total, 0);
});
