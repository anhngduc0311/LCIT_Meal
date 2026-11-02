const { test } = require('node:test');
const assert = require('node:assert/strict');
const MealRegistrationService = require('../../src/services/MealRegistrationService');

function setup(completionStatus = 'pending', existing = null) {
  const writes = [];
  const service = new MealRegistrationService({
    getByUserAndMeal: async () => existing,
    create: async data => { writes.push(data); return { id: 1, ...data, mealDate: '2099-11-02' }; },
    update: async () => { throw new Error('Unexpected update'); },
  }, { getWithCompletionStatus: async () => ({ id: 1, mealDate: '2099-11-02', isCancelled: false, completionStatus }) },
  { notifyRoles: async () => {} }, { create: async () => {} });
  service.assertBeforeRegistrationCutoff = async () => { throw new Error('Employee cutoff'); };
  return { service, writes };
}

test('Management can register on behalf after employee cutoff; employee cannot', async () => {
  for (const role of ['admin', 'manager']) {
    const { service, writes } = setup();
    const result = await service.create({ userId: 2, mealId: 1, guestCount: 0 }, { actorId: 1, roles: [role] });
    assert.equal(result.status, 'confirmed');
    assert.equal(writes.length, 1);
  }
  const { service, writes } = setup();
  await assert.rejects(service.create({ mealId: 1 }, { actorId: 2, roles: ['employee'] }), /Employee cutoff/);
  assert.equal(writes.length, 0);
});

test('Even management cannot change completed meal or registration', async () => {
  for (const [completion, existing] of [['completed', null], ['pending', { id: 2, status: 'completed' }]]) {
    const { service, writes } = setup(completion, existing);
    await assert.rejects(service.create({ userId: 2, mealId: 1 }, { actorId: 1, roles: ['admin'] }), /hoàn thành/);
    assert.equal(writes.length, 0);
  }
});
