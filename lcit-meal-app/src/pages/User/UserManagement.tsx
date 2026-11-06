import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import UserTable from "@/components/user/UserTable";
import UserFilters from "@/components/user/UserFilters";
import UserForm, { type UserFormValues } from "@/components/user/UserForm";
import type { User } from "@/api/types/auth";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import { userService, ApiError } from "@/api";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/common/Pagination";
import { pageMeta } from "../PageMeta";
import PageMeta from "@/components/common/PageMeta";

const statusLabel = (status: string) => (status === "1" ? "Hoạt động" : "Dừng hoạt động");

const UserManagementInner: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [q, setQ] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [editing, setEditing] = useState<User | null>(null);
    const { isOpen, openModal, closeModal } = useModal(false);
    const [viewing, setViewing] = useState<User | null>(null);
    const { showNotification } = useNotification();
    const confirm = useConfirm();
    // Danh sách người dùng có thể rất lớn (toàn bộ nhân sự cơ quan) - phân
    // trang ở tầng API, KHÔNG load toàn bộ danh sách 1 lần.
    const pagination = usePagination({ initialPage: 1, initialLimit: 10 });

    const normalizeHeader = (value: unknown) =>
        String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/đ/g, "d")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");

    const importUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                defval: "",
            });
            const users = rows.map((row) => {
                const values = Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
                );
                const statusValue = String(values.status || values.trangthai || "1").trim().toLowerCase();
                const roleValue = String(values.role || values.vaitro || "employee").trim().toLowerCase();
                const role = ({
                    "quản trị viên": "admin",
                    "quan tri vien": "admin",
                    "quản lý": "manager",
                    "quan ly": "manager",
                    "nhân viên": "employee",
                    "nhan vien": "employee",
                    "bếp ăn": "kitchen",
                    "bep an": "kitchen",
                } as Record<string, string>)[roleValue] ?? roleValue;
                return {
                    fullName: String(values.fullname || values.hovaten || "").trim(),
                    username: String(values.username || values.tendangnhap || "").trim(),
                    password: String(values.password || values.matkhau || "").trim(),
                    role,
                    status: ["0", "inactive", "ngunghoatdong"].includes(statusValue) ? "0" : "1",
                };
            });

            if (!users.length) throw new Error("File Excel không có dữ liệu.");
            const response = await userService.createBatch(users);
            showNotification(`Đã import ${response.payload.count} người dùng.`, "success");
            fetchUsers(pagination.page, pagination.limit);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Không thể import Excel",
                "error",
            );
        }
    };

    const fetchUsers = async (page: number, limit: number) => {
        setIsLoading(true);
        try {
            const response = await userService.listPaginated({
                query: q,
                role,
                status,
                page,
                limit,
            });

            setUsers(response.payload.data);
            pagination.updatePagination(response.payload.pagination);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi lấy danh sách người dùng",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Đổi bộ lọc -> quay về trang 1 (kết quả lọc mới có thể ít hơn tổng số
    // trang hiện tại).
    useEffect(() => {
        pagination.setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, role, status]);

    useEffect(() => {
        fetchUsers(pagination.page, pagination.limit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, role, status, pagination.page, pagination.limit]);

    const handleCreate = async (payload: UserFormValues) => {
        const ok = await confirm({
            title: "Xác nhận tạo người dùng",
            message: `Xác nhận tạo người dùng mới "${payload.fullName}"?`,
            confirmText: "Tạo mới",
        });
        if (!ok) return;
        try {
            await userService.create({
                fullName: payload.fullName,
                username: payload.username,
                password: payload.password ?? "",
                roleId: payload.roleId,
                status: payload.status,
            });
            showNotification("Đã tạo người dùng.", "success");
            closeModal();
            fetchUsers(pagination.page, pagination.limit);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tạo người dùng",
                "error",
            );
        }
    };

    const handleEdit = async (payload: UserFormValues) => {
        if (!payload.id) return;
        const ok = await confirm({
            title: "Xác nhận cập nhật người dùng",
            message: `Xác nhận lưu thay đổi cho người dùng "${payload.fullName}"?`,
            confirmText: "Lưu thay đổi",
        });
        if (!ok) return;
        try {
            await userService.update(payload.id, {
                fullName: payload.fullName,
                username: payload.username,
                password: payload.password,
                roleId: payload.roleId,
                status: payload.status,
            });
            setEditing(null);
            showNotification("Đã cập nhật người dùng.", "success");
            closeModal();
            fetchUsers(pagination.page, pagination.limit);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi cập nhật người dùng",
                "error",
            );
        }
    };

    const deleteUser = async (id: number) => {
        try {
            await userService.remove(id);
            showNotification("Đã xóa người dùng.", "success");
            fetchUsers(pagination.page, pagination.limit);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi xóa người dùng",
                "error",
            );
        }
    };

    const handleDelete = async (id: number) => {
        const ok = await confirm({
            title: "Xác nhận xóa người dùng",
            message: "Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác.",
            confirmText: "Xóa",
            variant: "danger",
        });
        if (!ok) return;
        await deleteUser(id);
    };

    // Đặt lại mật khẩu về mặc định (123456) - người dùng nên tự đổi lại sau khi đăng nhập.
    const handleResetPassword = async (u: User) => {
        const ok = await confirm({
            title: "Xác nhận reset mật khẩu",
            message: `Đặt lại mật khẩu của "${u.fullName}" (${u.username}) về mặc định "123456"? Người dùng sẽ phải đăng nhập lại bằng mật khẩu này.`,
            confirmText: "Reset mật khẩu",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await userService.resetPassword(u.id);
            showNotification(
                `Đã đặt lại mật khẩu của "${u.fullName}" về mặc định (123456).`,
                "success",
            );
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi reset mật khẩu",
                "error",
            );
        }
    };

    const handleStartEdit = (u: User) => {
        setEditing(u);
        openModal();
    };

    const closeView = () => setViewing(null);

    const handleDeleteFromView = async () => {
        if (!viewing) return;
        const ok = await confirm({
            title: "Xác nhận xóa người dùng",
            message: `Bạn có chắc muốn xóa người dùng "${viewing.fullName}" không? Hành động này không thể hoàn tác.`,
            confirmText: "Xóa",
            variant: "danger",
        });
        if (!ok) return;
        await deleteUser(viewing.id);
        closeView();
    };

    const handleEditFromView = () => {
        if (!viewing) return;
        setEditing(viewing);
        closeView();
        openModal();
    };

    return (
        <>
            <PageMeta
                title={pageMeta.users.title}
                description={pageMeta.users.description}
            />
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold dark:text-white/90">
                        Quản lý người dùng
                    </h2>
                    <div className="flex gap-2">
                        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">
                            Import Excel
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importUsers} />
                        </label>
                        <button
                            onClick={() => {
                                setEditing(null);
                                openModal();
                            }}
                            className="px-4 py-2 rounded-lg bg-brand-500 text-white"
                        >
                            Thêm người dùng
                        </button>
                    </div>
                </div>

                <div className="mb-4 bg-white rounded-lg shadow-sm dark:bg-gray-900 dark:text-white/90 border">
                    <UserFilters
                        q={q}
                        role={role}
                        status={status}
                        onChange={(c) => {
                            if (c.q !== undefined) setQ(c.q);
                            if (c.role !== undefined) setRole(c.role);
                            if (c.status !== undefined) setStatus(c.status);
                        }}
                    />
                </div>

                <Modal
                    isOpen={isOpen}
                    onClose={() => {
                        closeModal();
                        setEditing(null);
                    }}
                    className="max-w-2xl m-4 rounded-3xl overflow-hidden dark:bg-gray-900 dark:text-white/90"
                >
                    <div className="rounded-lg">
                        <UserForm
                            initial={editing || undefined}
                            onCancel={() => {
                                closeModal();
                                setEditing(null);
                            }}
                            onSubmit={(payload) =>
                                editing
                                    ? handleEdit({ ...payload, id: editing.id })
                                    : handleCreate(payload)
                            }
                        />
                    </div>
                </Modal>

                <Modal
                    isOpen={Boolean(viewing)}
                    onClose={closeView}
                    className="max-w-lg m-4 rounded-3xl overflow-hidden dark:bg-gray-900 dark:text-white/90"
                >
                    {viewing && (
                        <div className="space-y-5 bg-white p-6 dark:bg-gray-900">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Chi tiết người dùng
                                </p>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white/90">
                                    {viewing.fullName}
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Detail label="Tên đăng nhập" value={viewing.username} />
                                <Detail
                                    label="Vai trò"
                                    value={
                                        viewing.roles.length > 0 ? viewing.roles[0].displayName : ""
                                    }
                                />
                                <Detail label="Trạng thái" value={statusLabel(viewing.status)} />
                                <Detail label="Ngày tạo" value={viewing.createdAt} />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={handleEditFromView}
                                    className="rounded-lg border px-4 py-2 text-sm"
                                >
                                    Sửa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleResetPassword(viewing)}
                                    className="rounded-lg border px-4 py-2 text-sm text-amber-600"
                                >
                                    Reset mật khẩu
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteFromView}
                                    className="rounded-lg border px-4 py-2 text-sm text-red-600"
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>

                <div className="bg-white rounded-lg shadow-sm p-4 border dark:bg-gray-900 dark:text-white">
                    {isLoading ? (
                        <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Đang tải danh sách người dùng...</p>
                    ) : (
                        <>
                            <UserTable
                                users={users}
                                onEdit={handleStartEdit}
                                onDelete={handleDelete}
                                onView={setViewing}
                                onResetPassword={handleResetPassword}
                            />
                            <div className="mt-4">
                                <Pagination
                                    pagination={pagination.pagination}
                                    onPageChange={pagination.setPage}
                                    onLimitChange={pagination.setLimit}
                                    loading={isLoading}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

const Detail: React.FC<{ label: string; value: string }> = ({
    label,
    value,
}) => (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 font-medium text-gray-900 dark:text-white/90">{value}</p>
    </div>
);

export default UserManagementInner;
