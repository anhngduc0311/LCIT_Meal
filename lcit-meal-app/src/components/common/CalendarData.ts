// Generated sample registrations for August (excludes Saturdays and Sundays)
export const augustRegistrations: string[] = (() => {
  const year = 2026;
  const monthIndex = 7; // August (0-based)
  const daysInMonth = 31;
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    const wd = dt.getDay(); // 0 = Sun, 6 = Sat
    if (wd === 5 || wd === 6) continue; // skip weekend
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    out.push(`${year}-${mm}-${dd}`);
  }
  return out;
})();
