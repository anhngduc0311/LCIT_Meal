const cron = require('node-cron');
const PaymentService = require('../services/PaymentService');
const PaymentRepository = require('../repos/PaymentRepository');
const service = new PaymentService(new PaymentRepository());

async function runMonthlyBilling() {
  const result = await service.syncMonthlyPayments();
  if (result.created) console.log(`[monthlyBilling] Đã chốt ${result.created} khoản thanh toán.`);
  return result;
}

function start() {
  const run = () => runMonthlyBilling().catch(error => console.error('[monthlyBilling]', error.message));
  void run();
  cron.schedule('*/5 * * * *', run, { timezone: 'Asia/Ho_Chi_Minh', noOverlap: true, missedExecutionTolerance: 30000 });
}

module.exports = { start, runMonthlyBilling };
