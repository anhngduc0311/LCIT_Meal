// Canonical Vietnamese number; keep leading zero in storage and display.
module.exports = value => {
  if (typeof value !== 'string' || !/^[+\d\s().-]+$/u.test(value)) return '';
  let phone = value.replace(/[\s().-]/gu, '');
  if (phone.startsWith('0084')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith('84')) phone = `0${phone.slice(2)}`;
  return /^(?:0[35789]\d{8}|02\d{9})$/.test(phone) ? phone : '';
};
