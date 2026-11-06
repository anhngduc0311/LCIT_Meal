const AppError = require("../ultis/AppError");
const DASHBOARD_CHART_PERIODS = ["week", "month", "year"];

class DashboardService {
  constructor(dashboardRepository) {
    this.dashboardRepository = dashboardRepository;
  }

  async getHomeData(userId, date, facilityId) {
    if (facilityId !== undefined && !['1', '2', 'all'].includes(String(facilityId))) {
      throw new AppError('Cơ sở ăn không hợp lệ', 400);
    }
    const selectedFacility = facilityId === undefined || facilityId === 'all'
      ? undefined : Number(facilityId);
    if (date !== undefined) {
      const parsed = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00Z`) : null;
      if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new AppError("Ngày xem không hợp lệ (YYYY-MM-DD)", 400);
      }
    }
    return this.dashboardRepository.getHomeData(userId, date, selectedFacility);
  }

  // Dữ liệu biểu đồ trang chủ theo filter tuần/tháng/năm.
  // period không hợp lệ -> mặc định "week" (giữ hành vi cũ: 7 ngày gần nhất).
  async getChart(period, date, facilityId) {
    if (facilityId !== undefined && !['1','2','all','unassigned'].includes(String(facilityId))) {
      throw new AppError('Cơ sở ăn không hợp lệ', 400);
    }
    const selectedFacility = facilityId === undefined || facilityId === 'all' ? undefined
      : facilityId === 'unassigned' ? 'unassigned' : Number(facilityId);
    const safePeriod = DASHBOARD_CHART_PERIODS.includes(period)
      ? period
      : "week";

    const safeDate =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : undefined;

    return this.dashboardRepository.getChartByPeriod(safePeriod, safeDate, selectedFacility);
  }
}

module.exports = DashboardService;
