import { useState, useCallback } from "react";

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

interface UsePaginationOptions {
    initialPage?: number;
    initialLimit?: number;
}

/**
 * usePagination Hook - Quản lý state phân trang
 * Trả về: { pagination, page, limit, setPage, setLimit }
 */
export const usePagination = (options: UsePaginationOptions = {}) => {
    const { initialPage = 1, initialLimit = 10 } = options;

    const [page, setPage] = useState(initialPage);
    const [limit, setLimit] = useState(initialLimit);
    const [pagination, setPagination] = useState<PaginationMeta>({
        page: initialPage,
        limit: initialLimit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
    });

    // Cập nhật state phân trang từ API response
    const updatePagination = useCallback(
        (meta: Partial<PaginationMeta>) => {
            setPagination((prev) => ({
                ...prev,
                ...meta,
                page: meta.page ?? prev.page,
            }));
            if (meta.page !== undefined) {
                setPage(meta.page);
            }
            if (meta.limit !== undefined) {
                setLimit(meta.limit);
            }
        },
        []
    );

    // Đi đến trang cụ thể
    const goToPage = useCallback((pageNum: number) => {
        if (pageNum >= 1) {
            setPage(pageNum);
            setPagination((prev) => ({
                ...prev,
                page: pageNum,
            }));
        }
    }, []);

    // Đổi số bản ghi trên 1 trang (reset về trang 1)
    const changeLimit = useCallback((newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
        setPagination((prev) => ({
            ...prev,
            limit: newLimit,
            page: 1,
        }));
    }, []);

    // Trang tiếp theo
    const nextPage = useCallback(() => {
        if (pagination.hasNextPage) {
            goToPage(page + 1);
        }
    }, [page, pagination.hasNextPage, goToPage]);

    // Trang trước
    const prevPage = useCallback(() => {
        if (pagination.hasPreviousPage) {
            goToPage(page - 1);
        }
    }, [page, pagination.hasPreviousPage, goToPage]);

    // Reset về trang đầu
    const reset = useCallback(() => {
        setPage(1);
        setLimit(initialLimit);
        setPagination({
            page: 1,
            limit: initialLimit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
        });
    }, [initialLimit]);

    return {
        pagination,
        page,
        limit,
        setPage: goToPage,
        setLimit: changeLimit,
        nextPage,
        prevPage,
        updatePagination,
        reset,
    };
};

export default usePagination;
