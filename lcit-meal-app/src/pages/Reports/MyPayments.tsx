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
    getSettingAssetUrl,
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
    { label: "Ảnh chuyển khoản", align: "text-start" },
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
    const [reloadTick, setReloadTick] = useState(0);
    const [uploadPayment, setUploadPayment] = useState<Payment | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const pagination = usePagination({ initialPage: 1, initialLimit: 10 });
    // Đang tải khi dữ liệu đã nạp chưa ứng với bộ lọc/trang hiện tại.
    const requestKey = `${statusFilter}|${pagination.page}|${pagination.limit}|${reloadTick}`;
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const isHistoryLoading = loadedKey !== requestKey;

    useEffect(() => {
        if (!selectedFile) {
            setSelectedPreviewUrl("");
            return;
        }
        const url = URL.createObjectURL(selectedFile);
        setSelectedPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    const openUploadModal = (payment: Payment) => {
        setUploadPayment(payment);
        setSelectedFile(null);
    };

    const closeUploadModal = () => {
        setUploadPayment(null);
        setSelectedFile(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            showNotification("Chỉ hỗ trợ ảnh định dạng PNG, JPG hoặc WEBP", "error");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showNotification("Ảnh chuyển khoản không được vượt quá 5 MB", "error");
            return;
        }
        setSelectedFile(file);
    };

    const handleConfirmTransferred = async () => {
        if (!uploadPayment) return;
        if (!selectedFile) {
            showNotification("Vui lòng chọn ảnh đã chuyển tiền trước khi xác nhận", "error");
            return;
        }
        setIsUploading(true);
        try {
            await paymentService.submitProof(uploadPayment.id, selectedFile);
            showNotification(
                "Đã gửi ảnh xác nhận chuyển tiền. Quản trị viên sẽ kiểm tra và duyệt.",
                "success",
            );
            closeUploadModal();
            setReloadTick((v) => v + 1);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Gửi ảnh xác nhận thất bại",
                "error",
            );
        } finally {
            setIsUploading(false);
        }
    };

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
    }, [reloadTick]);

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
    }, [statusFilter, pagination.page, pagination.limit, reloadTick]);

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
                                <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                                    <p className="text-gray-800 dark:text-white/90">
                                        Hóa đơn {formatMonthYear(payable.month)}
                                    </p>
                                    {payable.payment ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatCurrency(payable.payment.amount)}
                                            </span>
                                            <PaymentStatusBadge status={payable.payment.status} />
                                            {payable.payment.status !== "paid" && !payable.payment.isPaid && (
                                                <button
                                                    type="button"
                                                    onClick={() => openUploadModal(payable.payment!)}
                                                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                                                >
                                                    {payable.payment.billImg
                                                        ? "Cập nhật ảnh CK"
                                                        : "Gửi ảnh & Xác nhận chuyển tiền"}
                                                </button>
                                            )}
                                            {payable.payment.billImg && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPreviewImageUrl(
                                                            getSettingAssetUrl(payable.payment!.billImg!),
                                                        )
                                                    }
                                                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                                                >
                                                    Xem ảnh CK
                                                </button>
                                            )}
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
                                    {history.map((payment) => {
                                        const isPaid = payment.status === "paid" || Boolean(payment.isPaid);
                                        const proofUrl = payment.billImg ? getSettingAssetUrl(payment.billImg) : "";
                                        return (
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
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <PaymentStatusBadge status={payment.status} />
                                                        {!isPaid && payment.billImg && (
                                                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                                                Đã gửi ảnh CK
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-5 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                                                    {payment.paidAt ? formatDateTime(payment.paidAt) : "-"}
                                                </TableCell>
                                                <TableCell className="px-5 py-3 text-theme-sm">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {proofUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewImageUrl(proofUrl)}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                                                            >
                                                                <img
                                                                    src={proofUrl}
                                                                    alt="Ảnh chuyển khoản"
                                                                    className="h-5 w-5 rounded object-cover"
                                                                />
                                                                Xem ảnh
                                                            </button>
                                                        )}
                                                        {!isPaid && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openUploadModal(payment)}
                                                                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                                                            >
                                                                {payment.billImg
                                                                    ? "Gửi lại ảnh"
                                                                    : "Gửi ảnh & Xác nhận CK"}
                                                            </button>
                                                        )}
                                                        {isPaid && !proofUrl && (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
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

            {/* Modal tải ảnh và xác nhận đã chuyển tiền */}
            {uploadPayment && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={closeUploadModal}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Xác nhận đã chuyển tiền
                            </h3>
                            <button
                                type="button"
                                onClick={closeUploadModal}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/[0.03]">
                            <p className="text-gray-600 dark:text-gray-300">
                                Kỳ thanh toán:{" "}
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatMonthYear(uploadPayment.paymentDate)}
                                </span>
                            </p>
                            <p className="mt-1 text-gray-600 dark:text-gray-300">
                                Số tiền cần chuyển:{" "}
                                <span className="font-semibold text-brand-600 dark:text-brand-400">
                                    {formatCurrency(uploadPayment.amount)}
                                </span>
                            </p>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-800 dark:text-white/90">
                                Ảnh chụp màn hình đã chuyển tiền (PNG, JPG, WEBP · tối đa 5 MB) *
                            </label>
                            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-4 text-center transition hover:border-brand-500 dark:border-gray-700 dark:bg-white/[0.02]">
                                {selectedPreviewUrl || uploadPayment.billImg ? (
                                    <img
                                        src={
                                            selectedPreviewUrl ||
                                            getSettingAssetUrl(uploadPayment.billImg || "")
                                        }
                                        alt="Xem trước ảnh chuyển khoản"
                                        className="max-h-64 rounded-lg object-contain"
                                    />
                                ) : (
                                    <div className="py-6">
                                        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
                                            Nhấn để chọn ảnh từ máy
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Tải lên ảnh biên lai / màn hình chuyển khoản thành công
                                        </p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                            {selectedFile && (
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    Đã chọn: {selectedFile.name}
                                </p>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeUploadModal}
                                disabled={isUploading}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmTransferred}
                                disabled={isUploading || !selectedFile}
                                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isUploading ? "Đang gửi..." : "Xác nhận đã chuyển tiền"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal xem ảnh chuyển khoản phóng to */}
            {previewImageUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Ảnh xác nhận chuyển khoản
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPreviewImageUrl(null)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                            >
                                ✕
                            </button>
                        </div>
                        <img
                            src={previewImageUrl}
                            alt="Ảnh xác nhận chuyển khoản"
                            className="mx-auto max-h-[70vh] rounded-lg object-contain"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default MyPayments;
