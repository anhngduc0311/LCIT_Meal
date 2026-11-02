// Invoices belong to the calendar month of paymentDate. Accrued meals and
// invoices describe the same debt, so they must never be added twice.
function buildMealLedger(days, payments, currentMonth) {
  const groups = new Map();
  const group = month => {
    if (!groups.has(month)) groups.set(month, { month, days: [], mealAmount: 0, invoicedAmount: 0, paidAmount: 0 });
    return groups.get(month);
  };
  group(currentMonth);
  for (const day of days) {
    const item = { date: day.date, staff: Number(day.staff), guests: Number(day.guests), amount: Number(day.amount) };
    const month = group(item.date.slice(0, 7));
    month.days.push(item);
    month.mealAmount += item.amount;
  }
  for (const payment of payments) {
    const month = group(payment.paymentDate.slice(0, 7));
    month.invoicedAmount += Number(payment.amount) || 0;
    if (payment.isPaid || payment.status === 'paid') month.paidAmount += Number(payment.paidAmount ?? payment.amount) || 0;
  }
  const months = [...groups.values()].map(month => {
    let available = month.paidAmount;
    month.days.sort((a, b) => a.date.localeCompare(b.date));
    for (const day of month.days) {
      const paid = Math.min(day.amount, available);
      day.unpaidAmount = day.amount - paid;
      available -= paid;
    }
    const totalAmount = Math.max(month.mealAmount, month.invoicedAmount);
    const unpaidAmount = Math.max(0, totalAmount - month.paidAmount);
    return { ...month, totalAmount, unpaidAmount, dueDate: new Date(Date.UTC(Number(month.month.slice(0, 4)), Number(month.month.slice(5)), 0)).toISOString().slice(0, 10) };
  }).sort((a, b) => b.month.localeCompare(a.month));
  return { currentMonth, months, totalUnpaidAmount: months.reduce((sum, month) => sum + month.unpaidAmount, 0), unpaidCount: months.filter(month => month.unpaidAmount > 0).length };
}

module.exports = { buildMealLedger };
