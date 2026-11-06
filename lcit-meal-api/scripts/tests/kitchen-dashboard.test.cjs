const assert = require('node:assert/strict');
const { test } = require('node:test');
let rows = [];
let guests = [];
const databasePath = require.resolve('../../src/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { async query(sql, params) {
    assert.match(sql, /mr.status IN \('confirmed','completed'\)/);
    assert.match(sql, /m.is_cancelled = 0/);
    assert.deepEqual(params, ['2026-11-04']);
    return [rows];
  } },
};
const mealsPath = require.resolve('../../src/repos/MealRepository');
require.cache[mealsPath] = { id: mealsPath, filename: mealsPath, loaded: true,
  exports: class { async filterGuestCounts(from, to) {
    assert.equal(from, '2026-11-04'); assert.equal(to, from); return guests;
  } },
};
const DashboardRepository = require('../../src/repos/DashboardRepository');
const DashboardController = require('../../src/controllers/DashboardController');

test('Kitchen counts 25 site-one registrations rather than 45 agency registrations', async () => {
  rows = [
    ...Array.from({ length: 25 }, () => ({ full_name: 'Kim Mạnh Cường', facility_id: null, guest_count: 0 })),
    ...Array.from({ length: 20 }, () => ({ full_name: 'Other staff', facility_id: 2, guest_count: 0 })),
  ];
  guests = [];
  assert.deepEqual(await new DashboardRepository().getKitchenStaff('2026-11-04', 1), {
    facility_id: 1, registered_staff_count: 25, total_guest_count: 0, total_meal_slots: 25,
  });
});

test('Kitchen includes linked and separate guests only for its site and honors explicit assignments', async () => {
  rows = [
    { full_name: 'Vũ Lê Duy', facility_id: null, guest_count: 2 },
    { full_name: 'Assigned staff', facility_id: 1, guest_count: 1 },
    { full_name: 'Kim Mạnh Cường', facility_id: 2, guest_count: 9 },
    { full_name: 'Unassigned staff', facility_id: null, guest_count: 8 },
  ];
  guests = [{ facilityId: 1, guestCount: 3 }, { facilityId: 2, guestCount: 20 }];
  assert.deepEqual(await new DashboardRepository().getKitchenStaff('2026-11-04', 1), {
    facility_id: 1, registered_staff_count: 2, total_guest_count: 6, total_meal_slots: 8,
  });
});

test('Home forwards the selected facility while kitchen accounts remain fixed to site one', async () => {
  for (const [roles, expected] of [
    [[{ code: 'kitchen' }], 1], [['kitchen'], 1], [[{ code: 'manager' }], 2],
    [[{ code: 'admin' }, { code: 'kitchen' }], 2],
  ]) {
    let called = false;
    const controller = new DashboardController({ async getHomeData(id, date, facility) {
      assert.equal(id, 7); assert.equal(date, '2026-11-04'); assert.equal(facility, expected);
      called = true; return {};
    } });
    await controller.getHome({ user: { id: 7, roles }, query: { date: '2026-11-04', facilityId: 2 } },
      { status() { return this; }, json() {} }, error => { throw error; });
    assert.equal(called, true);
  }
});

test('The meal card and staff breakdown use the same facility total', async () => {
  const repo = new DashboardRepository();
  repo.getTodayMeal = async () => ({ total_meal_slots: 45 });
  repo.getKitchenStaff = async () => ({ total_meal_slots: 25, registered_staff_count: 25 });
  repo.getWeeklyChart = async (facilityId, date) => {
    assert.equal(facilityId, 1);
    assert.equal(date, '2026-11-04');
    return [{ total_meal_slots: 125 }];
  };
  for (const method of ['getPaymentList', 'getOutstanding', 'getPendingMealOptionCount', 'getUnseenNotificationCount']) {
    repo[method] = async () => null;
  }
  const data = await repo.getHomeData(7, '2026-11-04', 1);
  assert.equal(data.todayMeal.total_meal_slots, 25);
  assert.equal(data.todayStaff.registered_staff_count, 25);
  assert.equal(data.weeklyChart[0].total_meal_slots, 125);
});
