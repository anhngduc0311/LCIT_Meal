const { test } = require('node:test');
const assert = require('node:assert/strict');
const MealService = require('../../src/services/MealService');
const Meal = require('../../src/models/Meal');

test('Meal summary exposes the date and numeric fields consumed by the management modal', async () => {
  const meal = new Meal({ id: 7, meal_date: '2026-11-04', status: 'active', is_cancelled: 0,
    registered_count: '25', guest_count_total: '3' });
  const service = new MealService({ async getSummary() { return meal; } });
  const result = await service.getSummary(7);
  assert.equal(result.meal.mealDate, '2026-11-04');
  assert.equal(result.totalRegistrations, 25);
  assert.equal(result.totalGuests, 3);
  assert.equal(result.totalMealSlots, 28);
  assert.equal(result.registeredCount, 25);
});

test('Empty and cancelled meal summaries show zero rather than blank values', async () => {
  for (const data of [{}, { is_cancelled: 1, registered_count: 25, guest_count_total: 3 }]) {
    const meal = new Meal({ id: 7, meal_date: '2026-11-04', status: 'active', ...data });
    const result = await new MealService({ async getSummary() { return meal; } }).getSummary(7);
    assert.equal(result.totalRegistrations, 0);
    assert.equal(result.totalGuests, 0);
    assert.equal(result.totalMealSlots, 0);
    assert.equal(result.meal.mealDate, '2026-11-04');
  }
});

test('A missing meal remains a 404 response', async () => {
  await assert.rejects(new MealService({ async getSummary() { return null; } }).getSummary(99), { statusCode: 404 });
});
