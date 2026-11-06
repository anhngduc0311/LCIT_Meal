import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";
import { attendanceRows, registrationRows, type MonthlyBoard, type ReportCell, type SiteOneReport } from "../../helper/mealReport";

async function saveReport(rows: ReportCell[][], filename: string, title: string) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet["!cols"] = Array.from({ length: Math.max(...rows.map(row => row.length)) }, (_, index) => ({ wch: index === 1 ? 32 : 16 }));
  xlsx.utils.book_append_sheet(workbook, sheet, title);
  xlsx.writeFile(workbook, filename);
}

export class ReportService {
  async getMonthlyBoard(month: string): Promise<MonthlyBoard> {
    const response = await apiClient.get<ApiResponse<MonthlyBoard>>(
      `/payments/monthly-board?month=${encodeURIComponent(month)}`,
    );
    return response.payload;
  }

  exportMealAttendance(report: SiteOneReport): Promise<void> {
    return saveReport(attendanceRows(report), `cham-com_co-so-1_${report.month}.xlsx`, "Chấm cơm cơ sở 1");
  }

  exportRegistrations(report: SiteOneReport): Promise<void> {
    return saveReport(registrationRows(report), `dang-ky-an_co-so-1_${report.month}.xlsx`, "Đăng ký cơ sở 1");
  }

  exportPayments(report: SiteOneReport): Promise<void> {
    const names = new Map(report.users.map(user => [user.id, user.fullName]));
    return saveReport([["Cán bộ", "Ngày thanh toán", "Phải thu", "Đã thu", "Trạng thái"],
      ...report.payments.map(payment => [names.get(payment.userId) || "", payment.paymentDate,
        Number(payment.amount), Number(payment.paidAmount ?? (payment.isPaid || payment.status === "paid" ? payment.amount : 0)),
        payment.status === "paid" || payment.isPaid ? "Đã thanh toán" : "Chưa thanh toán"])],
    `thanh-toan_co-so-1_${report.month}.xlsx`, "Thanh toán cơ sở 1");
  }
}

export const reportService = new ReportService();
