const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../../src/helper/mealReport.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const helper = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(sourcePath), helper, helper.exports);
const { buildSiteOneReport, attendanceRows, registrationRows } = helper.exports;

function board() {
  return {
    users: [
      { id: 1, fullName: 'Vũ Lê Duy', username: 'duy', facilityId: null },
      { id: 2, fullName: 'Kim Mạnh Cường', username: 'cuong', facilityId: 2 },
      { id: 3, fullName: 'Assigned staff', username: 'staff', facilityId: 1 },
      { id: 4, fullName: 'Unknown staff', username: 'unknown', facilityId: null },
      { id: 5, fullName: 'Quản lý', username: 'quanly', facilityId: 1 },
    ],
    meals: [
      { mealDate: '2026-11-02', status: 'active', isCancelled: 0 },
      { mealDate: '2026-11-03', status: 'active', isCancelled: 1 },
      { mealDate: '2026-11-04', status: 'inactive', isCancelled: 0 },
    ],
    registrations: [
      { userId: 1, mealDate: '2026-11-02', guestCount: 2, status: 'completed' },
      { userId: 3, mealDate: '2026-11-02', guestCount: 1, status: 'confirmed' },
      { userId: 2, mealDate: '2026-11-02', guestCount: 20, status: 'completed' },
      { userId: 4, mealDate: '2026-11-02', guestCount: 20, status: 'completed' },
      { userId: 5, mealDate: '2026-11-02', guestCount: 20, status: 'completed' },
      { userId: 1, mealDate: '2026-11-03', guestCount: 10, status: 'confirmed' },
      { userId: 1, mealDate: '2026-11-04', guestCount: 10, status: 'confirmed' },
      { userId: 1, mealDate: '2026-11-05', guestCount: 10, status: 'cancelled' },
      { userId: 3, mealDate: '2026-11-05', guestCount: 10, status: 'pending' },
      { userId: 1, mealDate: '2026-10-01', guestCount: 10, status: 'completed' },
    ],
    guests: [
      { mealDate: '2026-11-02', facilityId: 1, guestCount: 3 },
      { mealDate: '2026-11-02', facilityId: 2, guestCount: 20 },
      { mealDate: '2026-11-03', facilityId: 1, guestCount: 20 },
    ],
    payments: [
      { userId: 1, paymentDate: '2026-11-30', amount: 100, isPaid: true, paidAmount: null, status: 'paid' },
      { userId: 3, paymentDate: '2026-11-30', amount: 200, isPaid: false, paidAmount: 20, status: 'unpaid' },
      { userId: 2, paymentDate: '2026-11-30', amount: 900, isPaid: false, paidAmount: 0, status: 'unpaid' },
      { userId: 1, paymentDate: '2026-10-31', amount: 900, isPaid: false, paidAmount: 0, status: 'unpaid' },
    ],
  };
}

test('Site-one report honors assignments and roster aliases and excludes the management-only account', () => {
  const report = buildSiteOneReport(board(), '2026-11');
  assert.deepEqual(report.users.map(user => user.id), [1, 3]);
  assert.equal(report.totalRequests, 6);
  assert.deepEqual(report.totals, { staff: 2, guests: 6, total: 8, cancelled: 1, pending: 1 });
  assert.equal(report.daily[1].total, 8);
  assert.equal(report.daily[2].total, 0);
  assert.equal(report.daily[3].total, 0);
  assert.equal(report.daily.length, 30);
});

test('Payments only include site-one invoices in the selected month, including partial collections', () => {
  const report = buildSiteOneReport(board(), '2026-11');
  assert.equal(report.payments.length, 2);
  assert.equal(report.due, 300);
  assert.equal(report.collected, 120);
  assert.equal(report.outstanding, 180);
});

test('Attendance and registration exports reconcile with visible totals and exclude other facilities', () => {
  const report = buildSiteOneReport(board(), '2026-11');
  const attendance = attendanceRows(report);
  assert.equal(attendance.at(-1).at(-1), report.totals.total);
  assert.equal(attendance.slice(2, -1).reduce((sum, row) => sum + row.at(-1), 0), report.totals.total);
  assert.equal(registrationRows(report).slice(1).reduce((sum, row) => sum + row.at(-1), 0), report.totals.total);
  assert.equal(attendance.some(row => row.includes('Kim Mạnh Cường')), false);
  assert.equal(attendance.some(row => row.includes('Quản lý')), false);
});

test('Empty months and leap years retain daily rows and zero totals', () => {
  const report = buildSiteOneReport({ users: [], meals: [], registrations: [], guests: [], payments: [] }, '2028-02');
  assert.equal(report.daily.length, 29);
  assert.equal(report.daily.at(-1).date, '2028-02-29');
  assert.equal(report.totals.total, 0);
  assert.equal(report.outstanding, 0);
});

test('Exported XLSX retains Vietnamese names and numeric totals after reading it back', () => {
  const xlsx = require('xlsx');
  const report = buildSiteOneReport(board(), '2026-11');
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(attendanceRows(report)), 'Cơ sở 1');
  const bytes = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const restored = xlsx.read(bytes, { type: 'buffer' });
  const rows = xlsx.utils.sheet_to_json(restored.Sheets['Cơ sở 1'], { header: 1 });
  assert.equal(rows[2][1], 'Vũ Lê Duy');
  assert.equal(rows.at(-1).at(-1), 8);
});
