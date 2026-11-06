import { useEffect, useMemo, useState } from "react";
import type { PaginationMeta } from "./usePagination";

/**
 * useClientPagination - phân trang 1 mảng đã có sẵn ở client (thường là
 * kết quả sau khi đã lọc/tìm kiếm client-side).
 *
 * Khác với `usePagination` (dùng cho phân trang server-side, nơi
 * `total`/`totalPages` lấy từ response API), hook này tự tính toán
 * `pagination` meta từ chính độ dài mảng truyền vào - không gọi API.
 *
 * `resetKey` (ví dụ: chuỗi các giá trị filter nối lại) khi đổi giá trị sẽ
 * tự động đưa về trang 1, để tránh trường hợp đang ở trang 5 rồi lọc ra
 * kết quả chỉ còn 1 trang.
 */
export function useClientPagination<T>(
    items: T[],
    resetKey: string,
    initialLimit = 10,
) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(initialLimit);

    useEffect(() => {
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);

    const paginatedItems = useMemo(
        () => items.slice((currentPage - 1) * limit, currentPage * limit),
        [items, currentPage, limit],
    );

    const pagination: PaginationMeta = {
        page: currentPage,
        limit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
    };

    const changeLimit = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
    };

    return { paginatedItems, pagination, setPage, setLimit: changeLimit };
}

export default useClientPagination;
