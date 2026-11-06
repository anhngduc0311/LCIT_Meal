import apiClient from "../client";
import type { ApiResponse } from "../types/ApiResponse";
import type { Role } from "../types/auth";

export class RoleService {
  constructor(private readonly client = apiClient) {}

  async list(): Promise<Role[]> {
    const response = await this.client.get<ApiResponse<Role[]>>("/roles");
    return response.payload;
  }

  async getByCode(code: string): Promise<Role> {
    const response = await this.client.get<ApiResponse<Role>>(
      `/roles/code/${encodeURIComponent(code)}`,
    );
    return response.payload;
  }
}

export const roleService = new RoleService();
