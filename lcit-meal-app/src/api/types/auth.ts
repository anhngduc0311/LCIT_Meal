export interface Role {
  id: number;
  displayName: string;
  code: string;
  description: string;
  status: string;
  createdAt: string;
  createdBy: null | string;
  updatedAt: string;
  updatedBy: null | string;
}

export interface User {
  id: number;
  fullName: string;
  username: string;
  status: string;
  createdAt: string;
  createdBy: null | string;
  updatedAt: string;
  updatedBy: null | string;
  roles: Role[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  payload: {
    user: User;
    accessToken: string;
  };
  error: null | string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}