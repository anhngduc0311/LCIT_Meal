const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const Service = require('../../src/services/MealRegistrationService');
const Controller = require('../../src/controllers/MealRegistrationController');
const routes = require('../../src/routes/MealRegistrationRoutes');
const authorize = require('../../src/middlewares/authorizeMiddleware');

function service(settings = { registration_close_time: '08:00', meal_completion_time: '12:00' }) {
  return new Service({ get: async id => ({ id }) }, null, null, null, {
    getByKey: async key => settings[key] === undefined ? null : { settingValue: settings[key] },
  });
}

test('Employee registration window uses Vietnam time and exact cutoff/completion boundaries', async () => {
  const instance = service();
  const before = await instance.getRegistrationWindow(new Date('2026-11-06T00:59:59Z'));
  assert.equal(before.today, '2026-11-06');
  assert.equal(before.targetState, 'open');
  const closed = await instance.getRegistrationWindow(new Date('2026-11-06T01:00:00Z'));
  assert.equal(closed.nowTime, '08:00');
  assert.equal(closed.targetDate, '2026-11-06');
  assert.equal(closed.targetState, 'late');
  const completed = await instance.getRegistrationWindow(new Date('2026-11-06T05:00:00Z'));
  assert.equal(completed.isPastCompletion, true);
  assert.equal(completed.targetDate, '2026-11-07');
  assert.equal(completed.targetState, 'open');
});

test('Target dates roll across month/year ends and midnight stays at 00:00', async () => {
  const instance = service();
  assert.equal((await instance.getRegistrationWindow(new Date('2026-12-31T05:00:00Z'))).targetDate, '2027-01-01');
  const midnight = await instance.getRegistrationWindow(new Date('2026-12-31T17:00:00Z'));
  assert.equal(midnight.today, '2027-01-01');
  assert.equal(midnight.nowTime, '00:00');
  assert.equal(midnight.targetDate, '2027-01-01');
  assert.equal(midnight.isPastCompletion, false);
});

test('Window supports absent/invalid settings and configured completion times', async () => {
  const fallback = await service({ registration_close_time: '99:99', meal_completion_time: 'invalid' })
    .getRegistrationWindow(new Date('2026-11-06T02:00:00Z'));
  assert.equal(fallback.closeTime, null);
  assert.equal(fallback.completionTime, '12:00');
  assert.equal(fallback.targetState, 'open');
  const custom = await service({ registration_close_time: '08:30', meal_completion_time: '13:00' })
    .getRegistrationWindow(new Date('2026-11-06T05:30:00Z'));
  assert.equal(custom.isPastCompletion, false);
  assert.equal(custom.targetState, 'late');
});

test('Invalid registration IDs are rejected before reaching PostgreSQL', async () => {
  for (const id of ['window', 'invalid', '1.2', '-1', '0', '9007199254740992']) {
    await assert.rejects(service().get(id), { statusCode: 400 });
  }
  assert.deepEqual(await service().get('7'), { id: '7' });
});

test('GET /window reaches its named handler for staff and preserves route permissions', async () => {
  let idLookups = 0;
  const instance = service();
  instance.getForActor = async id => { idLookups++; return { id }; };
  const app = express();
  app.use('/api/meal-registrations', routes(new Controller(instance), (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({});
    req.user = { id: 7, roles: [{ code: role }] };
    next();
  }, authorize));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/meal-registrations`;
    for (const role of ['employee', 'manager', 'admin']) {
      const response = await fetch(`${base}/window`, { headers: { 'x-test-role': role } });
      assert.equal(response.status, 200);
      assert.match((await response.json()).payload.today, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.equal(idLookups, 0);
    assert.equal((await fetch(`${base}/window`)).status, 401);
    assert.equal((await fetch(`${base}/window`, { headers: { 'x-test-role': 'kitchen' } })).status, 403);
    assert.equal((await fetch(`${base}/7`, { headers: { 'x-test-role': 'employee' } })).status, 200);
    assert.equal(idLookups, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
