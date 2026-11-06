import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { authService } from "@/api/services/AuthService";
import type { LoginResponse } from "@/api/types/auth";
import { useAuth } from "@/context/AuthContext";

export default function SsoCallback() {
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuth();
  const request = useRef<Promise<LoginResponse> | null>(null);
  const completed = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (completed.current) return;
    if (!request.current) {
      const ticket = new URLSearchParams(window.location.hash.slice(1)).get("ticket");
      window.history.replaceState(null, "", window.location.pathname);
      request.current = ticket && /^[\w-]{43}$/.test(ticket)
        ? authService.exchangeSsoTicket(ticket)
        : Promise.reject(new Error("Phiên đăng nhập SSO không hợp lệ hoặc đã hết hạn."));
    }
    let active = true;
    request.current.then(response => {
      if (!active || completed.current) return;
      if (!response.success || !response.payload?.user || !response.payload.accessToken) {
        throw new Error("Không hoàn tất được đăng nhập SSO.");
      }
      completed.current = true;
      setUser(response.payload.user);
      setAccessToken(response.payload.accessToken);
      navigate("/", { replace: true });
    }).catch(error => {
      if (!active || completed.current) return;
      completed.current = true;
      setError(error instanceof Error ? error.message : "Không hoàn tất được đăng nhập SSO.");
    });
    return () => { active = false; };
  }, [navigate, setUser, setAccessToken]);

  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Đăng nhập SSO</h1>
      {error ? <><p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
        <Link className="mt-6 inline-block text-sm font-medium text-brand-500" to="/login">Quay lại đăng nhập</Link></>
        : <p role="status" className="mt-4 text-sm text-gray-500">Đang hoàn tất đăng nhập Cơm365...</p>}
    </div>
  </div>;
}
