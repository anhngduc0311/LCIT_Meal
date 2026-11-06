import React, { useEffect, useState } from "react";
import type { User, Role } from "@/api/types/auth";
import { ApiError, roleService, userService } from "@/api";
import Switch from "../form/switch/Switch";

// Backend lưu status dạng mã số dạng chuỗi (xem constants/UserStatus.js):
// "1" = active, "0" = inactive.
const STATUS_ACTIVE = "1";
const STATUS_INACTIVE = "0";

export type UserFormValues = {
    id?: number;
    fullName: string;
    username: string;
    password?: string;
    roleId?: number;
    status: string;
};

type Props = {
    initial?: Partial<User>;
    onCancel?: () => void;
    onSubmit: (user: UserFormValues) => void;
};

const UserForm: React.FC<Props> = ({
    initial,
    onCancel,
    onSubmit,
}) => {
    const isEdit = Boolean(initial?.id);

    const [name, setName] = useState(initial?.fullName ?? "");
    const [username, setUsername] = useState(initial?.username ?? "");
    const [password, setPassword] = useState("");
    const [roleId, setRoleId] = useState<number | "">(
        initial?.roles && initial.roles.length > 0 ? initial.roles[0].id : "",
    );
    const [status, setStatus] = useState<string>(
        initial?.status ?? STATUS_ACTIVE,
    );
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [usernameError, setUsernameError] = useState("");
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const value = username.trim();
        if (!value) {
            setUsernameError("");
            setIsCheckingUsername(false);
            return;
        }
        setIsCheckingUsername(true);
        const timer = window.setTimeout(() => {
            userService
                .checkUsername(value, initial?.id)
                .then((response) => setUsernameError(response.payload.message ?? ""))
                .catch((error) => setUsernameError(error instanceof ApiError ? error.message : "Không thể kiểm tra tên đăng nhập"))
                .finally(() => setIsCheckingUsername(false));
        }, 350);
        return () => window.clearTimeout(timer);
    }, [username, initial?.id]);

    useEffect(() => {
        if (!initial) {
            setName("");
            setUsername("");
            setPassword("");
            setRoleId("");
            setStatus(STATUS_ACTIVE);
            return;
        }

        setName(initial.fullName ?? "");
        setUsername(initial.username ?? "");
        setPassword("");
        setRoleId(
            initial.roles && initial.roles.length > 0
                ? initial.roles[0].id
                : "",
        );
        setStatus(initial.status ?? STATUS_ACTIVE);
    }, [initial]);

    useEffect(() => {
        roleService
            .list()
            .then(setRoles)
            .catch((error) => console.error("Lỗi khi tải danh sách vai trò:", error))
            .finally(() => setIsLoadingRoles(false));
    }, []);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!name.trim()) errors.name = "Họ và tên là bắt buộc";
        if (!username.trim()) errors.username = "Tên đăng nhập là bắt buộc";
        if (!isEdit && !password.trim()) errors.password = "Mật khẩu là bắt buộc";
        if (usernameError) errors.username = usernameError;
        setFieldErrors(errors);
        if (Object.keys(errors).length || isCheckingUsername) return;

        onSubmit({
            ...(initial?.id ? { id: initial.id } : {}),
            fullName: name.trim(),
            username: username.trim(),
            ...(password.trim() ? { password: password.trim() } : {}),
            ...(roleId !== "" ? { roleId: Number(roleId) } : {}),
            status,
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex max-h-[90vh] flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white/90"
        >
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        {isEdit ? (
                            <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                            </svg>
                        ) : (
                            <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        )}
                    </div>

                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                            {isEdit
                                ? "Cập nhật người dùng"
                                : "Thêm người dùng"}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-white/90">
                            {isEdit
                                ? "Chỉnh sửa thông tin và quyền truy cập của người dùng."
                                : "Tạo tài khoản người dùng mới và thiết lập quyền truy cập."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-5">
                    {/* Name */}
                    <div>
                        <label
                            htmlFor="user-name"
                            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white/90"
                        >
                            Họ và tên
                            <span className="ml-1 text-red-500">*</span>
                        </label>

                        <input
                            id="user-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                console.log("name changed:", e.target.value);
                                setFieldErrors((current) => ({ ...current, name: "" }));
                            }}
                            placeholder="Nhập họ và tên"
                            autoComplete="name"
                            className="
                                block w-full rounded-lg border border-gray-300
                                bg-white px-3.5 py-2.5 text-sm text-gray-900
                                dark:border-gray-700 dark:bg-gray-800 dark:text-white
                                outline-none transition
                                placeholder:text-gray-400
                                hover:border-gray-400
                                focus:border-brand-500
                                focus:ring-2 focus:ring-brand-500/20
                            "
                        />
                        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">✕ {fieldErrors.name}</p>}
                    </div>

                    {/* Username */}
                    <div>
                        <label
                            htmlFor="user-username"
                            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white/90"
                        >
                            Tên đăng nhập
                            <span className="ml-1 text-red-500">*</span>
                        </label>

                        <input
                            id="user-username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setFieldErrors((current) => ({ ...current, username: "" }));
                            }}
                            placeholder="Nhập tên đăng nhập"
                            autoComplete="username"
                            className="
                                block w-full rounded-lg border border-gray-300
                                bg-white px-3.5 py-2.5 text-sm text-gray-900
                                dark:border-gray-700 dark:bg-gray-800 dark:text-white
                                outline-none transition
                                placeholder:text-gray-400
                                hover:border-gray-400
                                focus:border-brand-500
                                focus:ring-2 focus:ring-brand-500/20
                            "
                        />
                        {(usernameError || fieldErrors.username) && <p className="mt-1 text-xs text-red-600">✕ {usernameError || fieldErrors.username}</p>}
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="user-password"
                            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white/90"
                        >
                            Mật khẩu
                            {!isEdit && <span className="ml-1 text-red-500">*</span>}
                        </label>

                        <input
                            id="user-password"
                            type="password"
                            required={!isEdit}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setFieldErrors((current) => ({ ...current, password: "" }));
                            }}
                            placeholder={isEdit ? "Để trống nếu không đổi mật khẩu" : "Nhập mật khẩu"}
                            autoComplete="new-password"
                            className="
                                block w-full rounded-lg border border-gray-300
                                bg-white px-3.5 py-2.5 text-sm text-gray-900
                                dark:border-gray-700 dark:bg-gray-800 dark:text-white
                                outline-none transition
                                placeholder:text-gray-400
                                hover:border-gray-400
                                focus:border-brand-500
                                focus:ring-2 focus:ring-brand-500/20
                            "
                        />
                        {fieldErrors.password && <p className="mt-1 text-xs text-red-600">✕ {fieldErrors.password}</p>}
                    </div>

                    {/* Role + Status */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* Role */}
                        <div>
                            <label
                                htmlFor="user-role"
                                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white/90"
                            >
                                Vai trò
                            </label>

                            <select
                                id="user-role"
                                value={roleId}
                                disabled={isLoadingRoles}
                                onChange={(e) =>
                                    setRoleId(e.target.value ? Number(e.target.value) : "")
                                }
                                className="
                                    block w-full rounded-lg border border-gray-300
                                    bg-white px-3.5 py-2.5 text-sm text-gray-900
                                    dark:border-gray-700 dark:bg-gray-800 dark:text-white
                                    outline-none transition
                                    hover:border-gray-400
                                    focus:border-brand-500
                                    focus:ring-2 focus:ring-brand-500/20
                                "
                            >
                                <option value="">Mặc định (nhân viên)</option>
                                {roles.map((role) => (
                                    <option value={role.id} key={role.id}>
                                        {role.displayName}
                                    </option>
                                ))}
                            </select>

                            <p className="mt-1.5 text-xs text-gray-500 dark:text-white/90">
                                Quyền truy cập của tài khoản.
                            </p>
                        </div>

                        {/* Status */}
                        <div>
                            <label
                                htmlFor="user-status"
                                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white/90"
                            >
                                Trạng thái
                            </label>
                            <Switch
                                label={status === STATUS_ACTIVE ? "Bật" : "Tắt"}
                                defaultChecked={status === STATUS_ACTIVE}
                                onChange={(value) => {
                                    setStatus(value ? STATUS_ACTIVE : STATUS_INACTIVE);
                                }}
                            />
                            <p className="mt-1.5 text-xs text-gray-500 dark:text-white/90">
                                Người dùng có thể đăng nhập khi ở trạng thái Active.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-white dark:bg-gray-900 px-6 py-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="
                        rounded-lg border border-gray-300
                        bg-white px-4 py-2.5 text-sm font-medium
                        text-gray-700 transition
                        hover:bg-gray-50
                        focus:outline-none
                        focus:ring-2 focus:ring-gray-400/20
                    "
                >
                    Hủy
                </button>

                <button
                    type="submit"
                    className="
                        rounded-lg bg-brand-500 px-4 py-2.5
                        text-sm font-medium text-white
                        shadow-sm transition
                        hover:bg-brand-600
                        focus:outline-none
                        focus:ring-2 focus:ring-brand-500/30
                    "
                >
                    {isEdit ? "Lưu thay đổi" : "Thêm người dùng"}
                </button>
            </div>
        </form>
    );
};

export default UserForm;
