const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMealLedger } = require('../../src/ultis/mealLedger');
const days = [
  { date: '2026-11-02', staff: 1, guests: 1, amount: 60000 },
  { date: '2026-11-03', staff: 1, guests: 0, amount: 30000 },
];
test('Daily accrued debt exists before any invoice; due at calendar month end', () => {
  const result = buildMealLedger(days, [], '2026-11');
  assert.equal(result.totalUnpaidAmount, 90000);
  assert.equal(result.months[0].days[0].unpaidAmount, 60000);
  assert.equal(result.months[0].dueDate, '2026-11-30');
  assert.equal(buildMealLedger([], [], '2028-02').months[0].dueDate, '2028-02-29');
});
test('Monthly invoice does not double debt; received money offsets days oldest first', () => {
  const invoice = { paymentDate: '2026-11-30', amount: 90000, status: 'unpaid' };
  assert.equal(buildMealLedger(days, [invoice], '2026-11').totalUnpaidAmount, 90000);
  const partial = buildMealLedger(days, [{ ...invoice, isPaid: 1, paidAmount: 70000 }], '2026-11');
  assert.equal(partial.totalUnpaidAmount, 20000);
  assert.deepEqual(partial.months[0].days.map(d => d.unpaidAmount), [0, 20000]);
  assert.equal(buildMealLedger(days, [{ ...invoice, status: 'paid' }], '2026-11').totalUnpaidAmount, 0);
});
test('Cut/restored days change accrued balance; months and overpayments stay separate', () => {
  const paid = { paymentDate: '2026-10-31', amount: 30000, status: 'paid', paidAmount: 50000 };
  assert.equal(buildMealLedger(days, [paid], '2026-11').totalUnpaidAmount, 90000);
  assert.equal(buildMealLedger(days.slice(1), [], '2026-11').totalUnpaidAmount, 30000);
  assert.equal(buildMealLedger(days, [], '2026-11').totalUnpaidAmount, 90000);
});
