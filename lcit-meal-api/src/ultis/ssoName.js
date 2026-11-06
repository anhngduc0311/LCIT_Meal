// Preserve accents and word order; only Unicode, whitespace and case are normalized.
module.exports = value => typeof value === 'string'
  ? value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi') : '';
