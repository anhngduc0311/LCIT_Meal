import type { User } from "../types/auth";
import apiClient from "../client";
import { ApiResponse } from "../types/ApiResponse";
import type { PaginatedResponse } from "../types/Pagination";

export type UserSearchParams = {
  query?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
};

// Payload gửi lên khi tạo người dùng mới. Khớp với UserService.create ở backend
// (fullName, username, password bắt buộc; roleId, status tùy chọn).
export type CreateUserRequest = {
  fullName: string;
  username: string;
  password: string;
  roleId?: number;
  status?: string;
};

// Khi cập nhật, password/roleId là tùy chọn (chỉ gửi khi người dùng thực sự đổi).
export type UpdateUserRequest = Partial<Omit<CreateUserRequest, "password">> & {
  password?: string;
};

export type BatchUserRequest = CreateUserRequest & {
  role?: string;
};

export class UserService {
  constructor(private readonly client = apiClient) {}

  list(params?: UserSearchParams) {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.role) searchParams.set("role", params.role);
    if (params?.status) searchParams.set("status", params.status);
    const query = searchParams.toString();
    // Dùng /users/filter khi có điều kiện lọc (khớp UserRoutes ở backend),
    // /users khi lấy toàn bộ danh sách.
    return this.client.get<ApiResponse<User[]>>(
      query ? `/users/filter?${query}` : "/users",
    );
  }

  // Danh sách người dùng có phân trang - dùng cho trang "Quản lý người
  // dùng" (bảng có thể có rất nhiều nhân sự, không nên load toàn bộ 1 lần).
  // Backend chỉ trả về `{ data, pagination }` khi có `page`/`limit` trong
  // query (xem ultis/paginate.js), nên luôn truyền page/limit ở đây.
  listPaginated(params: UserSearchParams & { page: number; limit: number }) {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("query", params.query);
    if (params.role) searchParams.set("role", params.role);
    if (params.status) searchParams.set("status", params.status);
    searchParams.set("page", String(params.page));
    searchParams.set("limit", String(params.limit));
    // /users/filter hỗ trợ cả trường hợp không có điều kiện lọc nào (chỉ
    // page/limit) nên luôn dùng route này khi cần phân trang.
    return this.client.get<ApiResponse<PaginatedResponse<User>>>(
      `/users/filter?${searchParams.toString()}`,
    );
  }

  getById(id: number | string) {
    return this.client.get<ApiResponse<User>>(`/users/${id}`);
  }

  create(payload: CreateUserRequest) {
    return this.client.post<ApiResponse<User>>("/users", payload);
  }

  createBatch(users: BatchUserRequest[]) {
    return this.client.post<ApiResponse<{ count: number; users: User[] }>>(
      "/users/batch",
      { users },
    );
  }

  checkUsername(username: string, excludeId?: number) {
    const params = new URLSearchParams({ username });
    if (excludeId) params.set("excludeId", String(excludeId));
    return this.client.get<
      ApiResponse<{ available: boolean; message: string | null }>
    >(`/users/availability?${params.toString()}`);
  }

  update(id: number | string, payload: UpdateUserRequest) {
    return this.client.put<ApiResponse<User>>(`/users/${id}`, payload);
  }

  remove(id: number | string) {
    return this.client.delete<ApiResponse<null>>(`/users/${id}`);
  }

  // admin - Đặt lại mật khẩu của người dùng về mật khẩu mặc định (123456)
  resetPassword(id: number | string) {
    return this.client.patch<ApiResponse<{ id: number; username: string }>>(
      `/users/${id}/reset-password`,
    );
  }

  // Tự cập nhật hồ sơ / đổi mật khẩu của chính người dùng đang đăng nhập.
  // Khác với update(): KHÔNG cho phép gửi roleId/status (backend cũng chặn).
  updateProfile(payload: { fullName?: string; password?: string }) {
    return this.client.patch<ApiResponse<User>>("/users/me", payload);
  }
}

export const userService = new UserService();
