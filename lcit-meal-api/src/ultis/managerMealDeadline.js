const AppError = require('./AppError');

const MANAGER_MEAL_CLOSED_MESSAGE = 'Đã chốt suất lúc 08:20 (giờ Việt Nam). Quản lý bếp không thể cắt suất, đăng ký lại hoặc điều chỉnh khách của ngày này.';

function assertManagerMealEditable(date, actor = {}, now = Date.now()) {
  const roles = (actor.roles || []).map(role => typeof role === 'string' ? role : role.code);
  if (!roles.includes('manager') || roles.includes('admin')) return;
  const deadline = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(`${date}T08:20:00+07:00`) : NaN;
  if (!Number.isFinite(deadline) || now >= deadline) throw new AppError(MANAGER_MEAL_CLOSED_MESSAGE, 409);
}

module.exports = { assertManagerMealEditable, MANAGER_MEAL_CLOSED_MESSAGE };
