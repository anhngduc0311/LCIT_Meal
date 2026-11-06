import React, { useEffect, useState } from "react";
import PageMeta from "@/components/common/PageMeta";
import Pagination from "@/components/common/Pagination";
import PaymentQrBlock from "@/components/payments/PaymentQrBlock";
import PaymentStatusBadge from "@/components/payments/PaymentStatusBadge";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    paymentService,
    settingsService,
    ApiError,
    type MyPaymentStatusFilter,
    type MyPaymentSummary,
    type Payment,
} from "@/api";
import { usePagination } from "@/hooks/usePagination";
import { useNotification } from "@/hooks/useNotification";
import { formatDateTime } from "@/helper/DateHelper";
import { formatCurrency, formatMonthYear } from "@/helper/FormatHelper";
import { panelClass } from "../shared/adminUiStyles";
import { PageTitle, EmptyState } from "../shared/AdminUI";
import { pageMeta } from "../PageMeta";

const HISTORY_COLUMNS = [
    { label: "Kỳ thanh toán", align: "text-start" },
    { label: "Số tiền", align: "text-end" },
    { label: "Đã trả", align: "text-end" },
    { label: "Trạng thái", align: "text-start" },
    { label: "Thanh toán lúc", align: "text-start" },
];

const STATUS_FILTERS: { value: MyPaymentStatusFilter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "paid", label: "Đã thanh toán" },
    { value: "unpaid", label: "Chưa thanh toán" },
];

// "2026-10-31" -> "31/10/2026"
const formatFullDate = (dateStr: string) => dateStr.split("-").reverse().join("/");

// Trang "Thanh toán" của cán bộ. Nguyên tắc: HẾT THÁNG MỚI TÍNH THANH TOÁN, và
// chỉ tính các suất ĐÃ ĂN (suất sắp ăn không tính).
//  - Số tiền phải trả: của THÁNG VỪA KẾT THÚC
//  - Tháng hiện tại: chỉ hiển thị số tạm tính, chưa phải thanh toán
//  - Lịch sử thanh toán cá nhân: mọi kỳ, lọc đã/chưa thanh toán, có phân trang
const MyPayments: React.FC = () => {
    const { showNotification } = useNotification();

    const [summary, setSummary] = useState<MyPaymentSummary | null>(null);
    const [paymentQr, setPaymentQr] = useState("");
    const [isSummaryLoading, setIsSummaryLoading] = useState(true);

    const [history, setHistory] = useState<Payment[]>([]);
    const [statusFilter, setStatusFilter] = useState<MyPaymentStatusFilter>("all");
    const pagination = usePagination({ initialPage: 1, initialLimit: 10 });
    // Đang tải khi dữ liệu đã nạp chưa ứng với bộ lọc/trang hiện tại.
    const requestKey = `${statusFilter}|${pagination.page}|${pagination.limit}`;
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const isHistoryLoading = loadedKey !== requestKey;

    useEffect(() => {
        let isMounted = true;

        paymentService
            .getMySummary()
            .then((result) => {
                if (isMounted) setSummary(result);
            })
            .catch((error) => {
                showNotification(
                    error instanceof ApiError ? error.message : "Lỗi khi tải dữ liệu thanh toán",
                    "error",
                );
            })
            .finally(() => {
                if (isMounted) setIsSummaryLoading(false);
            });

        settingsService
            .getByKey("payment_qr_image")
            .then((setting) => {
                if (isMounted) setPaymentQr(setting.setting_value);
            })
            .catch(() => setPaymentQr(""));

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lịch sử: tải lại khi đổi bộ lọc / trang / số dòng mỗi trang
    useEffect(() => {
        let isMounted = true;

        paymentService
            .listMinePaginated({
                status: statusFilter,
                page: pagination.page,
                limit: pagination.limit,
            })
            .then((result) => {
                if (!isMounted) return;
                setHistory(result.data);
                // Backend trả page/limit dạng chuỗi -> ép về số để không kích hoạt tải lại
                pagination.updatePagination({
                    ...result.pagination,
                    page: Number(result.pagination.page),
                    limit: Number(result.pagination.limit),
                });
                setLoadedKey(requestKey);
            })
            .catch((error) => {
                showNotification(
                    error instanceof ApiError ? error.message : "Lỗi khi tải lịch sử thanh toán",
                    "error",
                );
                if (isMounted) setLoadedKey(requestKey);
            });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pagination.page, pagination.limit]);

    const changeFilter = (value: MyPaymentStatusFilter) => {
        if (value === statusFilter) return;
        setStatusFilter(value);
        pagination.setPage(1); // đổi bộ lọc thì quay về trang đầu
    };

    const payable = summary?.payableMonth;
    const current = summary?.currentMonth;

    return (
        <>
            <PageMeta title={pageMeta.payment.title} description={pageMeta.payment.description} />
            <div className="p-6">
                <PageTitle title="Thanh toán của tôi" />

                {isSummaryLoading || !summary || !payable || !current ? (
                    <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
                        Đang tải dữ liệu thanh toán...
                    </p>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-3">
                        {/* Số tiền phải trả: tháng vừa kết thúc */}
                        <div className={`${panelClass} p-5 lg:col-span-2`}>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Số tiền phải trả — {formatMonthYear(payable.month)} (đã kết thúc)
                            </p>
                            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(payable.totalAmount)}
                            </p>
                            <p className="mt-1 text-sm text-success-600">
                                {payable.totalSlots} suất ăn
                                {payable.guestCount > 0 ? ` (gồm ${payable.guestCount} suất khách)` : ""}
                            </p>

                            <div className="mt-4 divide-y divide-gray-100 text-sm dark:divide-gray-800">
                                <div className="flex items-start justify-between gap-3 py-2">
                                    <div>
                                        <p className="text-gray-800 dark:text-white/90">Suất ăn của bạn</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {payable.mealCount} suất × {formatCurrency(summary.mealPrice)}
                                        </p>
                                    </div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(payable.mealAmount)}
                                    </p>
                                </div>
                                <div className="flex items-start justify-between gap-3 py-2">
                                    <div>
                                        <p className="text-gray-800 dark:text-white/90">Suất ăn cho khách</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {payable.guestCount} suất × {formatCurrency(summary.guestMealPrice)}
                                        </p>
                                    </div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(payable.guestAmount)}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between gap-3 py-2">
                                    <p className="text-gray-800 dark:text-white/90">
                                        Hóa đơn {formatMonthYear(payable.month)}
                                    </p>
                                    {payable.payment ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatCurrency(payable.payment.amount)}
                                            </span>
                                            <PaymentStatusBadge status={payable.payment.status} />
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Chưa lập hóa đơn
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Tháng hiện tại: chỉ tạm tính, chưa phải thanh toán */}
                            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/[0.03]">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium text-gray-800 dark:text-white/90">
                                        {formatMonthYear(current.month)} (tạm tính)
                                    </p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(current.totalAmount)}
                                    </p>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {current.totalSlots} suất đã ăn
                                    {current.guestCount > 0 ? ` (gồm ${current.guestCount} suất khách)` : ""} tính đến
                                    hôm nay. Chưa phải thanh toán — sẽ được tính khi hết tháng (
                                    {formatFullDate(current.closesOn)}).
                                </p>
                            </div>

                            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                Tiền ăn chỉ tính trên các suất đã ăn (không tính suất sắp ăn) và được tính khi hết
                                tháng. Số tiền chính thức theo hóa đơn do quản lý lập.
                            </p>
                        </div>

                        <PaymentQrBlock title="QR thanh toán" value={paymentQr} />
                    </div>
                )}

                {/* Lịch sử thanh toán: lọc + phân trang */}
                <div className={`${panelClass} mt-5 overflow-hidden`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Lịch sử thanh toán</h3>
                            {summary && (
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    {summary.outstanding.count > 0
                                        ? `${summary.outstanding.count} kỳ chưa thanh toán · còn ${formatCurrency(summary.outstanding.amount)}`
                                        : "Không có kỳ nào còn nợ"}
                                </p>
                            )}
                        </div>
                        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
                            {STATUS_FILTERS.map((filter) => (
                                <button
                                    key={filter.value}
                                    type="button"
                                    disabled={isHistoryLoading}
                                    onClick={() => changeFilter(filter.value)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${statusFilter === filter.value
                                            ? "bg-brand-500 text-white"
                                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isHistoryLoading && history.length === 0 ? (
                        <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
                            Đang tải lịch sử thanh toán...
                        </p>
                    ) : history.length === 0 ? (
                        <EmptyState
                            message={
                                statusFilter === "all"
                                    ? "Bạn chưa có kỳ thanh toán nào"
                                    : "Không có kỳ thanh toán nào phù hợp với bộ lọc"
                            }
                        />
                    ) : (
                        <div className={`overflow-x-auto transition-opacity ${isHistoryLoading ? "opacity-60" : ""}`}>
                            <Table>
                                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                                    <TableRow>
                                        {HISTORY_COLUMNS.map((column) => (
                                            <TableCell
                                                key={column.label}
                                                isHeader
                                                className={`px-5 py-3 ${column.align} text-theme-xs font-medium text-gray-500 dark:text-gray-400`}
                                            >
                                                {column.label}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {history.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell className="px-5 py-3 text-theme-sm text-gray-800 dark:text-white/90">
                                                {formatMonthYear(payment.paymentDate)}
                                            </TableCell>
                                            <TableCell className="px-5 py-3 text-end text-theme-sm text-gray-800 dark:text-white/90">
                                                {formatCurrency(payment.amount)}
                                            </TableCell>
                                            <TableCell className="px-5 py-3 text-end text-theme-sm text-gray-800 dark:text-white/90">
                                                {formatCurrency(payment.paidAmount)}
                                            </TableCell>
                                            <TableCell className="px-5 py-3 text-theme-sm">
                                                <PaymentStatusBadge status={payment.status} />
                                            </TableCell>
                                            <TableCell className="px-5 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                                                {payment.paidAt ? formatDateTime(payment.paidAt) : "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                        <Pagination
                            pagination={pagination.pagination}
                            onPageChange={pagination.setPage}
                            onLimitChange={pagination.setLimit}
                            loading={isHistoryLoading}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default MyPayments;
