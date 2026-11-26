import { useEffect, useState } from "react";
import { useNotification } from "@/hooks/useNotification";
import {
  settingsService,
  reportService,
  paymentService,
  getSettingAssetUrl,
  ApiError,
  type Payment,
} from "@/api";
import { inputClass, panelClass } from "../shared/adminUiStyles";
import { PageTitle } from "../shared/AdminUI";
import PageMeta from "@/components/common/PageMeta";
import PaymentQrBlock from "@/components/payments/PaymentQrBlock";
import PaymentStatusBadge from "@/components/payments/PaymentStatusBadge";
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
  const [paymentFilter, setPaymentFilter] = useState<"all" | "has_proof" | "unpaid" | "paid">("all");
  const [viewingProof, setViewingProof] = useState<{ payment: Payment; userName: string } | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);
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

  const handleMarkPaid = async (payment: Payment) => {
    setConfirmingPaymentId(payment.id);
    try {
      await paymentService.markPaid(payment.id, {
        paidAmount: Number(payment.amount),
        billImg: payment.billImg || undefined,
      });
      showNotification("Đã xác nhận thu tiền thành công", "success");
      setViewingProof(null);
      setState({ month: "", report: null, error: null });
      setReload((value) => value + 1);
    } catch (error) {
      showNotification(
        error instanceof ApiError ? error.message : "Xác nhận thu tiền thất bại",
        "error",
      );
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const userNameById = new Map((report?.users ?? []).map((u) => [u.id, u.fullName]));
  const proofCount = (report?.payments ?? []).filter((p) => Boolean(p.billImg)).length;
  const filteredReportPayments = (report?.payments ?? []).filter((p) => {
    const isPaid = p.status === "paid" || Boolean(p.isPaid);
    if (paymentFilter === "has_proof") return Boolean(p.billImg);
    if (paymentFilter === "paid") return isPaid;
    if (paymentFilter === "unpaid") return !isPaid;
    return true;
  });

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
              <div className={`${panelClass} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Danh sách hóa đơn &amp; Ảnh chuyển khoản · Cơ sở 1
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Xem ảnh xác nhận chuyển khoản của cán bộ và xác nhận đã thu tiền.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
                    {([
                      ["all", `Tất cả (${report.payments.length})`],
                      ["has_proof", `Đã gửi ảnh CK (${proofCount})`],
                      ["unpaid", "Chưa thanh toán"],
                      ["paid", "Đã thanh toán"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPaymentFilter(value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          paymentFilter === value
                            ? "bg-brand-500 text-white"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredReportPayments.length === 0 ? (
                  <p className="p-5 text-sm text-gray-500">
                    {report.payments.length === 0
                      ? "Chưa có hóa đơn của cán bộ cơ sở 1 trong kỳ này. Tiền phải thu được hiển thị theo các hóa đơn đã lập."
                      : "Không có hóa đơn nào phù hợp bộ lọc."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="whitespace-nowrap px-5 py-3 text-left">Cán bộ</th>
                          <th className="whitespace-nowrap px-5 py-3 text-left">Kỳ thanh toán</th>
                          <th className="whitespace-nowrap px-5 py-3 text-right">Số tiền</th>
                          <th className="whitespace-nowrap px-5 py-3 text-left">Trạng thái</th>
                          <th className="whitespace-nowrap px-5 py-3 text-left">Ảnh chuyển khoản</th>
                          <th className="whitespace-nowrap px-5 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredReportPayments.map((payment) => {
                          const isPaid = payment.status === "paid" || Boolean(payment.isPaid);
                          const name = payment.userName || userNameById.get(payment.userId) || `Cán bộ #${payment.userId}`;
                          const proofUrl = payment.billImg ? getSettingAssetUrl(payment.billImg) : "";
                          return (
                            <tr key={payment.id} className="text-gray-700 dark:text-gray-300">
                              <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                {name}
                              </td>
                              <td className="px-5 py-3">
                                {payment.paymentDate.slice(8, 10)}/{payment.paymentDate.slice(5, 7)}/{payment.paymentDate.slice(0, 4)}
                              </td>
                              <td className="px-5 py-3 text-right font-semibold tabular-nums">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <PaymentStatusBadge status={payment.status} />
                                  {!isPaid && payment.billImg && (
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                      Đã gửi ảnh CK
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                {proofUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingProof({ payment, userName: name })}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                                  >
                                    <img
                                      src={proofUrl}
                                      alt={`Ảnh chuyển khoản của ${name}`}
                                      className="h-7 w-7 rounded object-cover"
                                    />
                                    Xem ảnh CK
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">Chưa có ảnh</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {!isPaid ? (
                                  <button
                                    type="button"
                                    disabled={confirmingPaymentId === payment.id}
                                    onClick={() => { void handleMarkPaid(payment); }}
                                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                                  >
                                    {confirmingPaymentId === payment.id ? "Đang lưu..." : "Xác nhận đã thu"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-success-600">Hoàn tất</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="max-w-lg"><PaymentQrBlock title="QR thanh toán" value={paymentQr} /></div>
            </>}
          </>}
    </div>

    {viewingProof && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setViewingProof(null)}
      >
        <div
          className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Ảnh xác nhận chuyển khoản — {viewingProof.userName}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Số tiền: {formatCurrency(viewingProof.payment.amount)} · Kỳ {viewingProof.payment.paymentDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewingProof(null)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          {viewingProof.payment.billImg && (
            <img
              src={getSettingAssetUrl(viewingProof.payment.billImg)}
              alt={`Ảnh chuyển khoản của ${viewingProof.userName}`}
              className="mx-auto mt-4 max-h-[65vh] rounded-lg object-contain"
            />
          )}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setViewingProof(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Đóng
            </button>
            {viewingProof.payment.status !== "paid" && !viewingProof.payment.isPaid && (
              <button
                type="button"
                disabled={confirmingPaymentId === viewingProof.payment.id}
                onClick={() => { void handleMarkPaid(viewingProof.payment); }}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {confirmingPaymentId === viewingProof.payment.id ? "Đang xác nhận..." : "Xác nhận đã thu"}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </>;
}
