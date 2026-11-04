const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertManagerMealEditable } = require('../../src/ultis/managerMealDeadline');
const RegistrationService = require('../../src/services/MealRegistrationService');
const MealService = require('../../src/services/MealService');

test('Manager deadline locks exactly at 08:20 Vietnam time, including past days, with admin override', () => {
  const actor = { roles: ['manager'] };
  const before = Date.parse('2026-11-03T08:19:59.999+07:00');
  const cutoff = before + 1;
  assert.doesNotThrow(() => assertManagerMealEditable('2026-11-03', actor, before));
  for (const roles of [['manager'], [{ code: 'manager' }]]) {
    assert.throws(() => assertManagerMealEditable('2026-11-03', { roles }, cutoff), /08:20/);
    assert.throws(() => assertManagerMealEditable('2026-11-02', { roles }, cutoff), /08:20/);
    assert.doesNotThrow(() => assertManagerMealEditable('2026-11-04', { roles }, cutoff));
  }
  assert.doesNotThrow(() => assertManagerMealEditable('2026-11-03', { roles: ['admin', 'manager'] }, cutoff));
});

test('Manager cannot change locked registrations through create, update, approval or delete APIs', async () => {
  let writes = 0;
  const record = { id: 1, userId: 2, mealId: 1, mealDate: '2001-01-01', status: 'confirmed' };
  const meal = { id: 1, mealDate: record.mealDate, status: 'active' };
  const service = new RegistrationService({ get: async () => record, create: async () => writes++, update: async () => writes++, updateStatus: async () => writes++, delete: async () => writes++ },
    { getWithCompletionStatus: async () => meal });
  const actor = { actorId: 3, roles: ['manager'] };
  await assert.rejects(service.create({ userId: 2, mealId: 1 }, actor), /08:20/);
  for (const method of ['confirm', 'approveCancel', 'rejectCancel', 'cancel', 'delete']) {
    await assert.rejects(service[method](1, actor), /08:20/);
  }
  await assert.rejects(service.update(1, { guestCount: 2 }, actor), /08:20/);
  assert.equal(writes, 0);
});

test('Manager cannot add or remove guests after cutoff; admin can still adjust', async () => {
  let writes = 0;
  const service = new MealService({ get: async () => ({ mealDate: '2001-01-01' }),
    addGuestCount: async () => { writes++; return {}; }, removeGuestCount: async () => { writes++; return {}; } }, null, null, { create: async () => {} });
  for (const method of ['addGuests', 'removeGuests']) {
    await assert.rejects(service[method](1, { facilityId: 1, count: 1 }, { roles: ['manager'] }), /08:20/);
    assert.equal(writes, method === 'addGuests' ? 0 : 1);
    await service[method](1, { facilityId: 1, count: 1 }, { roles: ['admin'] });
  }
  assert.equal(writes, 2);
});
