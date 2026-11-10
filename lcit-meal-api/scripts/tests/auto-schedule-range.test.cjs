const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture() {
  const created = [];
  const registrations = [];
  const repositories = {
    MealRepository: {
      getByDate: async date => date === '2026-11-05' ? { id: date } : null,
      create: async data => { created.push(data.mealDate); return { id: data.mealDate }; },
    },
    MealRegistrationRepository: {
      getByUserAndMeal: async (userId, mealId) => mealId === '2026-11-05' ? { status: 'cancelled' } : null,
      create: async data => registrations.push(data),
    },
    UserRepository: { list: async () => [{ id: 2, status: '1', roles: ['employee'] }] },
    SystemSettingRepository: { getByKey: async () => ({ typedValue: true }) },
    MealOptionRepository: { list: async () => [{ userId: 2, status: 'approved', type: 'cancel_schedule', fromDate: '2026-11-06', toDate: '2026-11-06' }] },
    HolidayEventRepository: { list: async () => [] },
    MealScheduleConfigRepository: { getUseMealConfig: async () => true, getEnabledDays: async () => [1, 2, 3, 4, 5] },
  };
  const sandbox = {
    module: { exports: {} }, console: { log() {} },
    require(id) {
      const name = path.basename(id);
      if (repositories[name]) return class { constructor() { Object.assign(this, repositories[name]); } };
      if (id === './autoRegistrationEligibility') return require('../../src/jobs/autoRegistrationEligibility');
      if (name === 'MealRegistration') return { CONFIRMED: 'confirmed' };
      if (name === 'Meal') return { ACTIVE: 'active' };
      if (name === 'HolidayEvent') return { HOLIDAY_EVENT_STATUS: { ACTIVE: 'active' } };
      if (id === 'node-cron') return {};
      throw new Error(`Unexpected dependency ${id}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../src/jobs/autoScheduleJob.js'), 'utf8'), sandbox);
  return { run: sandbox.module.exports.runAutoSchedule, registerNewUsers: sandbox.module.exports.registerNewUsers, created, registrations };
}

test('Future backfill leaves historical days, weekends and existing cuts untouched', async () => {
  const { run, created, registrations } = fixture();
  await run('2026-11', { fromDate: '2026-11-04' });
  assert.ok(created.includes('2026-11-04'));
  assert.ok(created.every(date => date >= '2026-11-04'));
  assert.ok(!created.includes('2026-11-07'));
  assert.ok(registrations.some(row => row.mealId === '2026-11-04' && row.status === 'confirmed'));
  assert.ok(!registrations.some(row => ['2026-11-05', '2026-11-06'].includes(row.mealId)));
});

test('Backfill rejects invalid dates before creating meals', async () => {
  const { run, created } = fixture();
  await assert.rejects(run('2026-11', { fromDate: '2026-02-30' }), /valid YYYY-MM-DD/);
  assert.equal(created.length, 0);
});

test('New accounts get meals from tomorrow through month end, without enrolling existing staff', async () => {
  const { registerNewUsers, registrations } = fixture();
  await registerNewUsers([
    { id: 3, status: '1', roles: ['employee'] },
    { id: 4, status: '1', roles: ['manager'] },
    { id: 5, status: '0', roles: ['employee'] },
    { id: 6, status: '1', roles: ['admin'] },
  ], '2026-11-25');

  assert.deepEqual(registrations.map(row => [row.mealId, row.userId]), [
    ['2026-11-26', 3], ['2026-11-26', 4],
    ['2026-11-27', 3], ['2026-11-27', 4],
    ['2026-11-30', 3], ['2026-11-30', 4],
  ]);
});

test('An account created on the last day is left to the next monthly run', async () => {
  const { registerNewUsers, created, registrations } = fixture();
  await registerNewUsers([{ id: 3, status: '1', roles: ['employee'] }], '2026-11-30');
  assert.equal(created.length, 0);
  assert.equal(registrations.length, 0);
});
