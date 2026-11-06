import { ApiClient } from "./core/ApiClient";
import { apiConfig } from "./config";

// Tên sự kiện DOM được phát ra khi một request (đã có kèm bearer token) bị
// server từ chối với 401, tức token hiện tại đã bị thu hồi/hết hạn.
// AuthContext lắng nghe sự kiện này để tự động đăng xuất người dùng, giúp
// tách rời ApiClient (thuần TS) khỏi React context.
export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

export const apiClient = new ApiClient(apiConfig.baseUrl);

apiClient.setUnauthorizedHandler((error) => {
  window.dispatchEvent(
    new CustomEvent(AUTH_UNAUTHORIZED_EVENT, { detail: error }),
  );
});

export default apiClient;
