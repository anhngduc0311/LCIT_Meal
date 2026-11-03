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
    UserRepository: { list: async () => [{ id: 2 }] },
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
      if (id === './autoRegistrationEligibility') return { canAutoRegister: () => true };
      if (name === 'MealRegistration') return { CONFIRMED: 'confirmed' };
      if (name === 'Meal') return { ACTIVE: 'active' };
      if (name === 'HolidayEvent') return { HOLIDAY_EVENT_STATUS: { ACTIVE: 'active' } };
      if (id === 'node-cron') return {};
      throw new Error(`Unexpected dependency ${id}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../src/jobs/autoScheduleJob.js'), 'utf8'), sandbox);
  return { run: sandbox.module.exports.runAutoSchedule, created, registrations };
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
