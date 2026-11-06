import { useEffect, useState } from "react";
import { useNotification } from "@/hooks/useNotification";
import { settingsService, reportService, ApiError } from "@/api";
import { inputClass, panelClass } from "../shared/adminUiStyles";
import { PageTitle } from "../shared/AdminUI";
import PageMeta from "@/components/common/PageMeta";
import PaymentQrBlock from "@/components/payments/PaymentQrBlock";
import { formatCurrency } from "@/helper/FormatHelper";
import { buildSiteOneReport, type SiteOneReport } from "@/helper/mealReport";
import { pageMeta } from "../PageMeta";

type ReportState = { month: string; report: SiteOneReport | null; error: string | null };
const number = (value: number) => value.toLocaleString("vi-VN");
const buttonClass = "inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700";

export default function MealPaymentReports() {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit",
  }).format(new Date()).slice(0, 7));
  const [tab, setTab] = useState<"meals" | "payments">(() => window.location.hash === "#payments" ? "payments" : "meals");
  const [state, setState] = useState<ReportState>({ month: "", report: null, error: null });
  const [reload, setReload] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [paymentQr, setPaymentQr] = useState("");
  const { showNotification } = useNotification();
  const meal = tab === "meals";
  const loading = state.month !== month;
  const report = loading ? null : state.report;

  useEffect(() => {
    let active = true;
    reportService.getMonthlyBoard(month).then(board => {
      if (active) setState({ month, report: buildSiteOneReport(board, month), error: null });
    }).catch(error => {
      if (active) setState({ month, report: null, error: error instanceof ApiError ? error.message : "Không tải được báo cáo. Vui lòng thử lại." });
    });
    return () => { active = false; };
  }, [month, reload]);

  useEffect(() => {
    let active = true;
    settingsService.getByKey("payment_qr_image").then(setting => {
      if (active) setPaymentQr(setting.setting_value);
    }).catch(() => { if (active) setPaymentQr(""); });
    return () => { active = false; };
  }, []);

  const changeTab = (next: "meals" | "payments") => {
    setTab(next);
    window.history.replaceState(null, "", `/reports#${next}`);
  };
  const exportReport = async (kind: "attendance" | "registrations" | "payments") => {
    if (!report) return;
    setIsExporting(true);
    try {
      if (kind === "attendance") await reportService.exportMealAttendance(report);
      else if (kind === "registrations") await reportService.exportRegistrations(report);
      else await reportService.exportPayments(report);
      showNotification("Đã xuất báo cáo cơ sở 1", "success");
    } catch (error) {
      showNotification(error instanceof Error ? error.message : "Không xuất được Excel", "error");
    } finally { setIsExporting(false); }
  };

  const cards = !report ? [] : meal ? [
    { label: "Tổng lượt đăng ký", value: number(report.totalRequests), note: `${number(report.totals.staff)} lượt cán bộ có suất · ${number(report.totals.pending)} chờ duyệt` },
    { label: "Suất ăn có hiệu lực", value: number(report.totals.total), note: `${number(report.totals.staff)} suất cán bộ + ${number(report.totals.guests)} suất khách` },
    { label: "Lượt đã cắt", value: number(report.totals.cancelled), note: `${report.totalRequests ? Math.round(report.totals.cancelled / report.totalRequests * 100) : 0}% lượt đăng ký của cơ sở 1` },
  ] : [
    { label: "Tổng tiền phải thu", value: formatCurrency(report.due), note: `${report.payments.length} hóa đơn của cán bộ cơ sở 1` },
    { label: "Đã thanh toán", value: formatCurrency(report.collected), note: "Số tiền đã ghi nhận trên hóa đơn" },
    { label: "Còn phải thu", value: formatCurrency(report.outstanding), note: "Theo hóa đơn trong kỳ đã chọn" },
  ];

  return <>
    <PageMeta title={pageMeta.reports.title} description={pageMeta.reports.description} />
    <div className="space-y-5">
      <div>
        <PageTitle title="Báo cáo / Thống kê · Cơ sở 1" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Số liệu cán bộ và khách tại cơ sở 1, đồng nhất với ứng dụng LCIT Meal.</p>
      </div>
      <div className={`${panelClass} flex flex-wrap items-center justify-between gap-4 p-3`}>
        <div className="flex gap-1" role="tablist" aria-label="Loại báo cáo">
          {([['meals', 'Thống kê suất ăn'], ['payments', 'Thanh toán']] as const).map(([value, label]) =>
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => changeTab(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === value ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}>{label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="report-month" className="shrink-0 whitespace-nowrap text-sm font-medium">Kỳ báo cáo</label>
          <input id="report-month" type="month" value={month} className={`${inputClass} w-auto min-w-44`}
            onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }} />
          <button type="button" className={buttonClass} disabled={loading} onClick={() => {
            setState({ month: "", report: null, error: null }); setReload(value => value + 1);
          }}>Làm mới</button>
        </div>
      </div>

      {loading ? <p role="status" className={`${panelClass} p-6 text-sm text-gray-500`}>Đang tải báo cáo cơ sở 1...</p>
        : state.error ? <div role="alert" className={`${panelClass} p-6 text-sm text-red-600`}>{state.error}</div>
          : report && <>
            <div className="grid gap-4 lg:grid-cols-3">{cards.map(card => <div className={`${panelClass} p-5`} key={card.label}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.note}</p>
            </div>)}</div>
            <div className={`${panelClass} flex flex-wrap items-center gap-3 p-4`}>
              {meal ? <>
                <button type="button" className={`${buttonClass} border-transparent bg-brand-500 text-white`} disabled={isExporting || report.totals.total === 0} onClick={() => { void exportReport("attendance"); }}>Xuất bảng chấm cơm (Excel)</button>
                <button type="button" className={buttonClass} disabled={isExporting || (report.totalRequests === 0 && report.guests.length === 0)} onClick={() => { void exportReport("registrations"); }}>Xuất danh sách đăng ký</button>
              </> : <>
                <button type="button" className={`${buttonClass} border-transparent bg-brand-500 text-white`} disabled={isExporting || report.payments.length === 0} onClick={() => { void exportReport("payments"); }}>Xuất Excel thanh toán</button>
                <button type="button" className={buttonClass} onClick={() => window.print()}>In báo cáo</button>
              </>}
              {isExporting && <span role="status" className="text-sm text-gray-500">Đang xuất Excel...</span>}
              <span className="text-xs text-gray-500">Dữ liệu xuất chỉ gồm cơ sở 1 · Kỳ {month.slice(5)}/{month.slice(0, 4)}</span>
            </div>

            {meal ? <div className={`${panelClass} overflow-hidden`}>
              <div className="border-b border-gray-200 p-5 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">Chi tiết suất ăn theo ngày · Cơ sở 1</h2>
                <p className="mt-1 text-sm text-gray-500">Tính đăng ký đã xác nhận và đã ăn; gồm khách đi kèm và khách đăng ký riêng. Không tính suất chờ duyệt, đã cắt hoặc bếp nghỉ.</p>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr>{["Ngày ăn", "Cán bộ", "Khách", "Tổng suất", "Đã cắt", "Chờ duyệt"].map(label => <th key={label} className="whitespace-nowrap px-5 py-3 text-right first:text-left">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{report.daily.map(day => <tr key={day.date} className="text-gray-700 dark:text-gray-300">
                  <td className="px-5 py-3">{day.date.slice(8)}/{day.date.slice(5, 7)}/{day.date.slice(0, 4)}</td>
                  {[day.staff, day.guests, day.total, day.cancelled, day.pending].map((value, index) => <td key={index} className={`px-5 py-3 text-right tabular-nums ${index === 2 ? "font-semibold" : ""}`}>{number(value)}</td>)}
                </tr>)}</tbody>
                <tfoot className="bg-gray-50 font-semibold dark:bg-gray-800"><tr><td className="px-5 py-3">Tổng tháng</td>{[report.totals.staff, report.totals.guests, report.totals.total, report.totals.cancelled, report.totals.pending].map((value, index) => <td key={index} className="px-5 py-3 text-right tabular-nums">{number(value)}</td>)}</tr></tfoot>
              </table></div>
              {report.totalRequests === 0 && report.guests.length === 0 && <p className="p-5 text-sm text-gray-500">Chưa có đăng ký suất ăn tại cơ sở 1 trong kỳ này.</p>}
            </div> : <>
              {report.payments.length === 0 && <p className={`${panelClass} p-5 text-sm text-gray-500`}>Chưa có hóa đơn của cán bộ cơ sở 1 trong kỳ này. Tiền phải thu được hiển thị theo các hóa đơn đã lập.</p>}
              <div className="max-w-lg"><PaymentQrBlock title="QR thanh toán" value={paymentQr} /></div>
            </>}
          </>}
    </div>
  </>;
}
