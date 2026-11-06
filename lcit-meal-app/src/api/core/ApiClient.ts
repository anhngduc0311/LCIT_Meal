import { ApiError } from "./ApiError";

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
  /**
   * Đặt true cho các request không cần xử lý tự động đăng xuất khi 401
   * (vd: chính request /auth/login, /auth/logout).
   */
  skipAuthHandling?: boolean;
};

type ApiErrorPayload = {
  message?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
};

/**
 * Được gọi khi server trả về 401 cho một request ĐÃ có kèm bearer token,
 * nghĩa là token hiện tại không còn hợp lệ (hết hạn / bị thu hồi / user bị khoá...).
 * Đăng ký callback này từ AuthContext để tự động đăng xuất người dùng.
 */
export type UnauthorizedHandler = (error: ApiError) => void;

export class ApiClient {
  private unauthorizedHandler: UnauthorizedHandler | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => string | null = () =>
      localStorage.getItem("access_token"),
  ) {}

  /**
   * Đăng ký handler được gọi mỗi khi API trả về 401 cho một request đã gửi kèm
   * bearer token (token bị hủy/hết hạn). Trả về hàm hủy đăng ký.
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.unauthorizedHandler = handler;
    return () => {
      if (this.unauthorizedHandler === handler) {
        this.unauthorizedHandler = null;
      }
    };
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15000,
    );
    // Luôn đọc token mới nhất tại thời điểm gửi request (không cache),
    // đảm bảo bearer token luôn được đính kèm nếu người dùng đã đăng nhập.
    const token = this.getAccessToken();
    const headers = new Headers(options.headers);

    headers.set("Accept", "application/json");
    const isFormData = options.body instanceof FormData;
    if (options.body !== undefined && !isFormData)
      headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
      const response = await fetch(this.buildUrl(path), {
        ...options,
        body:
          options.body === undefined || isFormData
            ? (options.body as BodyInit | undefined)
            : JSON.stringify(options.body),
        headers,
        signal: options.signal ?? controller.signal,
      });

      const payload = await this.parseResponse(response);
      if (!response.ok) {
        const errorPayload = this.asErrorPayload(payload);
        const apiError = new ApiError(
          this.extractErrorMessage(errorPayload),
          response.status,
          this.extractErrorCode(errorPayload),
          payload,
        );

        // Bearer token đã được gửi kèm nhưng bị server từ chối (401) => token
        // đã bị thu hồi/hết hạn. Kích hoạt đăng xuất tự động, trừ khi request
        // được đánh dấu bỏ qua (vd: chính API login).
        if (
          response.status === 401 &&
          token &&
          !options.skipAuthHandling &&
          this.unauthorizedHandler
        ) {
          this.unauthorizedHandler(apiError);
        }

        throw apiError;
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("Yêu cầu API đã hết thời gian chờ.", 408);
      }
      throw new ApiError(
        "Không thể kết nối đến máy chủ.",
        0,
        "NETWORK_ERROR",
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private buildUrl(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) return response.json();
    return response.text();
  }

  private asErrorPayload(payload: unknown): ApiErrorPayload {
    return typeof payload === "object" && payload !== null
      ? (payload as ApiErrorPayload)
      : {};
  }

  // Backend trả lỗi theo dạng { success:false, payload, error: { code, message } },
  // nhưng đôi khi cũng có dạng { message } hoặc { error: "..." } đơn giản hơn.
  // Hàm này chuẩn hóa để luôn lấy được message dạng chuỗi dễ hiểu cho người dùng.
  private extractErrorMessage(errorPayload: ApiErrorPayload): string {
    if (errorPayload.message) return errorPayload.message;
    if (typeof errorPayload.error === "string") return errorPayload.error;
    if (errorPayload.error?.message) return errorPayload.error.message;
    return "Yêu cầu API thất bại.";
  }

  private extractErrorCode(errorPayload: ApiErrorPayload): string | undefined {
    if (errorPayload.code) return errorPayload.code;
    if (typeof errorPayload.error === "object" && errorPayload.error?.code) {
      return errorPayload.error.code;
    }
    return undefined;
  }
}
