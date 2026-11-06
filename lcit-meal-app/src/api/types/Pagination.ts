// Khớp với shape trả về bởi `ultis/paginate.js` ở backend khi request có
// `page`/`limit`: `{ data, pagination: { page, limit, total, totalPages,
// hasNextPage, hasPreviousPage } }`. Dùng chung cho mọi API danh sách hỗ
// trợ phân trang, tương tự PaginationMeta/PaginatedResponse đã có sẵn ở
// MealService.ts (giữ nguyên ở đó để không phá vỡ import cũ).
export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
    data: T[];
    pagination: PaginationMeta;
};

export type PageParams = {
    page?: number;
    limit?: number;
};
