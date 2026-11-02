const { test } = require('node:test');
const assert = require('node:assert/strict');
const { billingCutoff, vietnamClock } = require('../../src/ultis/monthlyBilling');

test('Billing waits until the configured completion time on the actual last day', () => {
  assert.equal(billingCutoff('2026-11-02', '15:00'), '2026-10-31');
  assert.equal(billingCutoff('2026-11-30', '11:59'), '2026-10-31');
  assert.equal(billingCutoff('2026-11-30', '12:00'), '2026-11-30');
  assert.equal(billingCutoff('2026-11-30', '12:00', '13:30'), '2026-10-31');
  assert.equal(billingCutoff('2028-02-29', '12:00'), '2028-02-29');
  assert.equal(billingCutoff('2027-01-01', '00:00'), '2026-12-31');
  assert.deepEqual(vietnamClock(new Date('2026-11-30T05:00:00Z')), { date: '2026-11-30', time: '12:00' });
});
