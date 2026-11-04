const ROLE = require('../constants/Role');

function canAutoRegister(user) {
  const roles = (user.roles || []).map(role => typeof role === 'string' ? role : role.code);
  return String(user.status) === '1'
    && String(user.username || '').trim().toLowerCase() !== 'quanly'
    && !roles.includes(ROLE.KITCHEN)
    && !roles.includes(ROLE.ADMIN)
    && roles.some(role => role === ROLE.EMPLOYEE || role === ROLE.MANAGER);
}

module.exports = { canAutoRegister };
