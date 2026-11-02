function billingCutoff(date, time, completionTime = '12:00') {
  const [year, month] = date.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return date === end && time >= completionTime
    ? end : new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
}

function vietnamClock(now = new Date()) {
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
  };
}

module.exports = { billingCutoff, vietnamClock };
