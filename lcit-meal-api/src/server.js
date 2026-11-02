const app = require("./app");
const env = require("./config/env");
const autoScheduleJob = require("./jobs/autoScheduleJob");
const paymentReminderJob = require("./jobs/paymentReminderJob");
const mealCompletionJob = require("./jobs/mealCompletionJob");
const monthlyBillingJob = require('./jobs/monthlyBillingJob');
const SystemSettingRepository = require("./repos/SystemSettingRepository");
const MealScheduleConfigRepository = require("./repos/MealScheduleConfigRepository");

app.listen(env.port, env.host, async () => {
  console.log(`Server running on port ${env.port}`);
  try {
    const systemSettingRepo = new SystemSettingRepository();
    const mealScheduleConfigRepo = new MealScheduleConfigRepository();
    await systemSettingRepo.ensureDefaults();
    await mealScheduleConfigRepo.ensureDefaults();
  } catch (err) {
    console.error("Lỗi khởi tạo cấu hình mặc định:", err);
  }
  autoScheduleJob.start();
  paymentReminderJob.start();
  mealCompletionJob.start();
  monthlyBillingJob.start();
});
