const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canAutoRegister } = require('../../src/jobs/autoRegistrationEligibility');

test('The shared quanly account is management-only; named managers remain eligible', () => {
  for (const username of ['quanly',' QUANLY ']) assert.equal(canAutoRegister({username,status:'1',roles:['manager']}),false);
  assert.equal(canAutoRegister({username:'huydq',status:'1',roles:['manager']}),true);
});

test('Kitchen and system administrator accounts never receive automatic meals', () => {
  for (const roles of [['kitchen'], [{ code: 'kitchen' }], ['employee', 'kitchen'], ['admin'], ['admin', 'employee']]) {
    assert.equal(canAutoRegister({ status: '1', roles }), false);
  }
});

test('Only active employees and managers receive automatic meals', () => {
  for (const role of ['employee', 'manager']) {
    assert.equal(canAutoRegister({ status: '1', roles: [{ code: role }] }), true);
    assert.equal(canAutoRegister({ status: 1, roles: [role] }), true);
    for (const status of ['0', '2', '-1']) assert.equal(canAutoRegister({ status, roles: [role] }), false);
  }
  assert.equal(canAutoRegister({ status: '1', roles: [] }), false);
});
