const { test } = require('node:test');
const assert = require('node:assert/strict');
const MealService = require('../../src/services/MealService');

test('Only management may remove guests, with valid facility and positive integer count', async () => {
  const service = new MealService({});
  for (const role of ['employee', 'kitchen']) {
    await assert.rejects(service.removeGuests(1, { facilityId: 1, count: 1 }, { roles: [role] }), { statusCode: 403 });
  }
  for (const data of [{ facilityId: 3, count: 1 }, ...[0, -1, 1.5, 1001, '1'].map(count => ({ facilityId: 1, count }))]) {
    await assert.rejects(service.removeGuests(1, data, { roles: ['manager'] }), { statusCode: 400 });
  }
});

test('Removing guests records the facility and actor; stale counts return a conflict', async () => {
  const writes = [], logs = [];
  const service = new MealService({
    get: async () => ({ mealDate: '2026-11-02' }),
    removeGuestCount: async (...args) => { writes.push(args); return { mealId: 1, facilityId: 2, guestCount: 0 }; },
  }, null, null, { create: async data => logs.push(data) });
  const actor = { actorId: 9, roles: ['manager'] };
  const result = await service.removeGuests(1, { facilityId: 2, count: 3 }, actor);
  assert.equal(result.guestCount, 0);
  assert.equal(result.mealDate, '2026-11-02');
  assert.deepEqual(writes, [[1, 2, 3, 9]]);
  assert.equal(logs.length, 1);
  service.mealRepository.removeGuestCount = async () => null;
  await assert.rejects(service.removeGuests(1, { facilityId: 2, count: 3 }, actor), { statusCode: 409 });
  assert.equal(logs.length, 1);
});
