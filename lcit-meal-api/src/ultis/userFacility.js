const names = require('../constants/FacilityOneNames.json');
const normalize = name => (name || '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi');
const facilityOneNames = new Set(names.map(normalize));

module.exports = function userFacility(user) {
  const assigned = Number(user.facility_id);
  if (assigned === 1 || assigned === 2) return assigned;
  return facilityOneNames.has(normalize(user.full_name)) ? 1 : null;
};
