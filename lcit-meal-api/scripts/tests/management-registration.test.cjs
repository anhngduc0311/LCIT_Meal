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

test('Management can register completed meals; employee still cannot', async () => {
  for (const role of ['admin', 'manager']) {
    const { service, writes } = setup('completed');
    const result = await service.create({ userId: 2, mealId: 1 }, { actorId: 1, roles: [role] });
    assert.equal(result.status, 'completed');
    assert.equal(writes.length, 1);
  }
  for (const [completion, existing] of [['completed', null], ['pending', { id: 2, status: 'completed' }]]) {
    const { service, writes } = setup(completion, existing);
    service.assertBeforeRegistrationCutoff = async () => {};
    await assert.rejects(service.create({ mealId: 1 }, { actorId: 2, roles: ['employee'] }), /hoàn thành/);
    assert.equal(writes.length, 0);
  }
});

test('Only administrators can cancel completed or past meals after the manager deadline', async () => {
  const { service } = setup();
  for (const role of ['admin']) {
    const permission = await service.checkCancellationPermission({ status: 'completed' }, { mealDate: '2001-01-02', completionStatus: 'completed' }, { roles: [role] });
    assert.deepEqual(permission, { canCancel: true, requiresApproval: false, reason: null });
  }
  await assert.rejects(service.checkCancellationPermission({ status: 'completed' }, { mealDate: '2001-01-02' }, { roles: ['manager'] }), /08:20/);
  assert.equal((await service.checkCancellationPermission({ status: 'completed' }, { mealDate: '2001-01-02', completionStatus: 'completed' }, { roles: ['employee'] })).canCancel, false);
});

test('Controller actor supports string and object role forms', () => {
  const { getActor } = require('../../src/ultis/actor');
  for (const user of [{ id: 1, roles: ['admin'] }, { id: 1, roles: [{ code: 'manager' }] }, { id: 1, role: 'admin' }]) {
    assert.ok(getActor({ user, headers: {} }).roles.some(r => ['admin', 'manager'].includes(r)));
  }
});

test('Daily cancellation is immediate when allowed and never becomes a pending approval', async () => {
  const { service } = setup();
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const reg = { status: 'confirmed' };
  const meal = { mealDate: today, completionStatus: 'serving' };
  const actor = { roles: ['employee'] };
  assert.deepEqual(await service.checkCancellationPermission(reg, meal, actor), { canCancel: true, requiresApproval: false, reason: null });
  service.systemSettingRepository = { getByKey: async () => ({ settingValue: '00:00' }) };
  const locked = await service.checkCancellationPermission(reg, meal, actor);
  assert.equal(locked.canCancel, false);
  assert.equal(locked.requiresApproval, false);
});

test('Daily cuts auto-apply; range and permanent cuts wait for a decision', async () => {
  const MealOptionService = require('../../src/services/MealOptionService');
  for (const type of ['cancel_today', 'cancel_schedule', 'cancel_permanent']) {
    let applied = 0, notified = 0;
    const service = new MealOptionService({ create: async data => ({ id: 1, ...data }) }, {},
      { notifyRoles: async () => { notified++; } }, { create: async () => {} });
    service.syncMealRegistrations = async () => { applied++; };
    const result = await service.create({ type, fromDate: '2099-11-02', toDate: '2099-11-02' }, { actorId: 1, roles: ['employee'] });
    assert.equal(result.status, type === 'cancel_today' ? 'approved' : 'pending');
    assert.equal(applied, type === 'cancel_today' ? 1 : 0);
    assert.equal(notified, type === 'cancel_today' ? 0 : 1);
  }
});
