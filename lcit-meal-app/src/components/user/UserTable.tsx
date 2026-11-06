import React from "react";
import type { User } from "@/api/types/auth";
import { formatDate } from "@/helper/DateHelper";

type Props = {
    users: User[];
    onEdit: (u: User) => void;
    onDelete: (id: number) => void;
    onView: (u: User) => void;
    // Đặt lại mật khẩu về mặc định (admin)
    onResetPassword: (u: User) => void;
};

// Backend lưu status dạng mã số dạng chuỗi (constants/UserStatus.js): "1" = active.
const statusLabel = (status: string) => (status === "1" ? "Hoạt động" : "Dừng hoạt động");

const UserTable: React.FC<Props> = ({ users, onEdit, onDelete, onView, onResetPassword }) => {
    return (
        <div className="max-h-150 overflow-y-auto overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
                <thead>
                    <tr className="text-left">
                        <th className="px-4 py-2">Họ tên</th>
                        <th className="px-4 py-2">Tên đăng nhập</th>
                        <th className="px-4 py-2">Vai trò</th>
                        <th className="px-4 py-2">Trạng thái</th>
                        <th className="px-4 py-2">Ngày tạo</th>
                        <th className="px-4 py-2">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id} className="odd:bg-gray-50 dark:odd:bg-gray-800">
                            <td className="px-4 py-3 align-middle">{u.fullName}</td>
                            <td className="px-4 py-3 align-middle">{u.username}</td>
                            <td className="px-4 py-3 align-middle">{u.roles.length > 0 ? u.roles[0].displayName : ""}</td>
                            <td className="px-4 py-3 align-middle">{statusLabel(u.status)}</td>
                            <td className="px-4 py-3 align-middle">{formatDate(u.createdAt)}</td>
                            <td className="px-4 py-3 align-middle">
                                <div className="flex gap-2">
                                    <button onClick={() => onView(u)} className="px-3 py-1 rounded-lg border">Xem</button>
                                    <button onClick={() => onEdit(u)} className="px-3 py-1 rounded-lg border">Sửa</button>
                                    <button onClick={() => onResetPassword(u)} className="px-3 py-1 rounded-lg border text-amber-600 whitespace-nowrap">Reset mật khẩu</button>
                                    <button onClick={() => onDelete(u.id)} className="px-3 py-1 rounded-lg border text-red-600">Xóa</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserTable;
