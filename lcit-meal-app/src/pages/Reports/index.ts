export { default } from "./MealPaymentReports";
export { default as MealPaymentReports } from "./MealPaymentReports";
export { default as MealStatisticsReports } from "./MealStatisticsReports";

// Alias giữ lại để tương thích ngược - trước đây cùng trỏ về MealPaymentReports
// (chưa có nơi nào trong code base dùng tới 2 tên này, nhưng vẫn export
// phòng khi có chỗ tham chiếu bên ngoài).
export { default as MealStatistics } from "./MealPaymentReports";
export { default as PaymentStatistics } from "./MealPaymentReports";
