import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";

// Khớp với models/AuditLog.js ở backend (dùng snake_case, khác các model khác).
export type AuditLog = {
  id: number;
  log_actor: number | null;
  actor_name: string | null;
  log_action: string;
  log_target: string | null;
  log_result: string;
  log_detail: string | null;
  log_time: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  old_data: unknown;
  new_data: unknown;
};

export type AuditLogFilterParams = {
  query?: string;
  actor?: string;
  action?: string;
  target?: string;
  result?: string;
  status?: string;
};

export class AuditLogService {
  constructor(private readonly client = apiClient) {}

  async list(): Promise<AuditLog[]> {
    const response = await this.client.get<ApiResponse<AuditLog[]>>(
      "/audit-logs",
    );
    return response.payload;
  }

  async filter(params: AuditLogFilterParams): Promise<AuditLog[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });
    const query = searchParams.toString();
    const response = await this.client.get<ApiResponse<AuditLog[]>>(
      `/audit-logs/filter${query ? `?${query}` : ""}`,
    );
    return response.payload;
  }

  async getById(id: number | string): Promise<AuditLog> {
    const response = await this.client.get<ApiResponse<AuditLog>>(
      `/audit-logs/${id}`,
    );
    return response.payload;
  }
}

export const auditLogService = new AuditLogService();
