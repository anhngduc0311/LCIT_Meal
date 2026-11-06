import { apiConfig } from "./config";
import { ApiError } from "./core/ApiError";

// fetch() thuần (không qua ApiClient) vì response là file nhị phân (blob),
// không phải JSON theo chuẩn { success, payload }. Vẫn cần tự đính kèm
// Bearer token vì đây không phải điều hướng trình duyệt thông thường.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem("access_token");
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiConfig.baseUrl}${path}`, { headers });

  if (!response.ok) {
    let message = "Không thể tải file.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // response không phải JSON (vd lỗi mạng), giữ message mặc định
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
