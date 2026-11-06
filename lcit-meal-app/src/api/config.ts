const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const apiConfig = {
  baseUrl: apiBaseUrl,
  timeoutMs: 15000,
} as const;
