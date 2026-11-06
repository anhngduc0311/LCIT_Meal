import type { Setting } from "@/data/settings";
import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

export type UpdateSettingsRequest = Pick<
  Setting,
  "setting_key" | "setting_value"
>[];

// Backend trả về field dạng camelCase (settingKey, settingValue, ...),
// trong khi phần UI hiện tại (SettingForm, data/settings.ts) dùng snake_case.
// Hàm này chuẩn hóa dữ liệu về đúng shape `Setting` mà UI đang mong đợi.
type BackendSetting = {
  id: number | string;
  settingKey: string;
  settingValue: string;
  displayName: string;
  dataType: string;
  description: string;
  updatedAt: string;
  updatedBy: string | number | null;
};

const toSetting = (raw: BackendSetting): Setting => ({
  id: String(raw.id),
  setting_key: raw.settingKey,
  setting_value: raw.settingValue,
  display_name: raw.displayName,
  data_type: raw.dataType,
  description: raw.description,
  updated_at: raw.updatedAt,
  updated_by: raw.updatedBy != null ? String(raw.updatedBy) : "",
});

export class SettingsService {
  constructor(private readonly client = apiClient) {}

  async list(): Promise<Setting[]> {
    const response =
      await this.client.get<ApiResponse<BackendSetting[]>>("/system-settings");
    return response.payload.map(toSetting);
  }

  async updateMany(settings: UpdateSettingsRequest): Promise<Setting[]> {
    const response = await this.client.put<ApiResponse<BackendSetting[]>>(
      "/system-settings/bulk",
      {
        settings: settings.map((setting) => ({
          settingKey: setting.setting_key,
          settingValue: setting.setting_value,
        })),
      },
    );
    return response.payload.map(toSetting);
  }

  async getByKey(key: string): Promise<Setting> {
    const response = await this.client.get<ApiResponse<BackendSetting>>(
      `/system-settings/key/${encodeURIComponent(key)}`,
    );
    return toSetting(response.payload);
  }

  async uploadPaymentQr(file: File): Promise<Setting> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await this.client.post<ApiResponse<BackendSetting>>(
      "/system-settings/payment-qr",
      formData,
    );
    return toSetting(response.payload);
  }
}

export const getSettingAssetUrl = (value: string) => {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${baseUrl.replace(/\/api\/?$/, "")}${value}`;
};

export const settingsService = new SettingsService();
