import React, { useState } from "react";
import {
    mdiChevronLeft,
    mdiChevronRight,
    mdiChevronDoubleLeft,
    mdiChevronDoubleRight,
} from "@mdi/js";

import { Icon } from "@mdi/react";

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

interface PaginationProps {
    pagination: PaginationMeta;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    loading?: boolean;
    showPageNumbers?: boolean;
    maxPageButtons?: number;
}

/**
 * Pagination Component - Hiển thị phân trang
 * Hỗ trợ:
 * - First, Previous, Next, Last page buttons
 * - Direct page number navigation
 * - Limit selector (bản ghi trên 1 trang)
 * - Go to page input
 */
const Pagination: React.FC<PaginationProps> = ({
    pagination,
    onPageChange,
    onLimitChange,
    loading = false,
    showPageNumbers = true,
    maxPageButtons = 7,
}) => {
    const [jumpPage, setJumpPage] = useState("");

    const { page, limit, total, totalPages, hasNextPage, hasPreviousPage } =
        pagination;

    // Tính số bản ghi hiện tại đang hiển thị
    const startRecord = (page - 1) * limit + 1;
    const endRecord = Math.min(page * limit, total);

    // Lấy danh sách số trang cần hiển thị
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const sideButtons = Math.floor((maxPageButtons - 1) / 2);

        let startPage = Math.max(1, page - sideButtons);
        let endPage = Math.min(totalPages, page + sideButtons);

        // Điều chỉnh phạm vi nếu gần đầu hoặc cuối
        if (startPage === 1) {
            endPage = Math.min(totalPages, maxPageButtons - 1);
        }
        if (endPage === totalPages) {
            startPage = Math.max(1, totalPages - maxPageButtons + 2);
        }

        // Thêm trang đầu
        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2) pages.push("...");
        }

        // Thêm các trang giữa
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        // Thêm trang cuối
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pages.push("...");
            pages.push(totalPages);
        }

        return pages;
    };

    const handleJumpPage = () => {
        const pageNum = parseInt(jumpPage);
        if (pageNum && pageNum >= 1 && pageNum <= totalPages) {
            onPageChange(pageNum);
            setJumpPage("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleJumpPage();
        }
    };

    const limitOptions = [10, 20, 25, 50, 100];

    return (
        <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            {/* Bộ điều khiển chính */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                {/* Thông tin trang hiện tại */}
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Hiển thị{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                        {startRecord}
                    </span>{" "}
                    đến{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                        {endRecord}
                    </span>{" "}
                    / Tổng{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                        {total}
                    </span>{" "}
                    bản ghi
                </div>

                {/* Chọn số bản ghi trên 1 trang */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Bản ghi/trang:
                    </label>
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        disabled={loading}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-gray-500"
                    >
                        {limitOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Điều khiển phân trang */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Nút Previous/Next */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(1)}
                        disabled={loading || !hasPreviousPage}
                        title="Trang đầu tiên"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        <Icon path={mdiChevronDoubleLeft} size={0.8} />
                    </button>

                    <button
                        type="button"
                        onClick={() => onPageChange(page - 1)}
                        disabled={loading || !hasPreviousPage}
                        title="Trang trước"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        <Icon path={mdiChevronLeft} size={0.8} />
                        Trước
                    </button>

                    <button
                        type="button"
                        onClick={() => onPageChange(page + 1)}
                        disabled={loading || !hasNextPage}
                        title="Trang sau"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        Sau
                        <Icon path={mdiChevronRight} size={0.8} />
                    </button>

                    <button
                        type="button"
                        onClick={() => onPageChange(totalPages)}
                        disabled={loading || !hasNextPage}
                        title="Trang cuối cùng"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        <Icon path={mdiChevronDoubleRight} size={0.8} />
                    </button>
                </div>

                {/* Hiển thị số trang (nếu bật) */}
                {showPageNumbers && totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-1">
                        {getPageNumbers().map((pageNum, idx) => {
                            if (pageNum === "...") {
                                return (
                                    <span
                                        key={`ellipsis-${idx}`}
                                        className="px-2 text-gray-400"
                                    >
                                        ...
                                    </span>
                                );
                            }

                            const isCurrentPage = pageNum === page;
                            return (
                                <button
                                    key={`page-${pageNum}`}
                                    onClick={() => {
                                        if (typeof pageNum === "number") {
                                            onPageChange(pageNum);
                                        }
                                    }}
                                    disabled={loading}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium transition ${isCurrentPage
                                        ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                        : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Nhảy đến trang cụ thể */}
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Đi đến trang:
                </label>
                <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    placeholder={String(page)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button
                    onClick={handleJumpPage}
                    disabled={loading || !jumpPage}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                    Đi
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    / {totalPages} trang
                </span>
            </div>
        </div>
    );
};

export default Pagination;
