import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
import {
    notificationService,
    userService,
    ApiError,
    type SystemNotification,
} from "@/api";
import type { User } from "@/api/types/auth";
import { inputClass, panelClass } from "../shared/adminUiStyles";
import {
    PageTitle,
    SearchBox,
    EmptyState,
    FormActions,
    Actions,
    TableHead,
    DetailModal,
} from "../shared/AdminUI";
import { useClientPagination } from "@/hooks/useClientPagination";
import Pagination from "@/components/common/Pagination";
import PageMeta from "@/components/common/PageMeta";
import { pageMeta } from "../PageMeta";

const NotificationForm: React.FC<{
    initial?: SystemNotification;
    users: User[];
    onSave: (data: {
        title: string;
        content: string;
        status: string;
        userIds?: number[];
    }) => void;
    onCancel: () => void;
}> = ({ initial, users, onSave, onCancel }) => {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [content, setContent] = useState(initial?.content ?? "");
    const [userId, setUserId] = useState<string>("all");
    const [status, setStatus] = useState(initial?.status ?? "active");
    return (
        <form
            className="space-y-4 bg-white p-6 dark:bg-gray-900"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({
                    title,
                    content,
                    status,
                    userIds: userId === "all" ? undefined : [Number(userId)],
                });
            }}
        >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {initial ? "Sửa thông báo" : "Thêm thông báo"}
            </h3>
            <input
                className={inputClass}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tiêu đề"
            />
            <textarea
                className={inputClass}
                required
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Nội dung"
                rows={3}
            />
            {!initial && (
                <select
                    className={inputClass}
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                >
                    <option value="all">Tất cả người dùng</option>
                    {users.map((user) => (
                        <option value={user.id} key={user.id}>
                            {user.fullName}
                        </option>
                    ))}
                </select>
            )}
            <select
                className={inputClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
            >
                <option value="active">Hoạt động</option>
                <option value="inactive">Ẩn</option>
            </select>
            <FormActions onCancel={onCancel} />
        </form>
    );
};

const NotificationManagement: React.FC = () => {
    const [items, setItems] = useState<SystemNotification[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState<SystemNotification | undefined>();
    const [viewing, setViewing] = useState<SystemNotification | null>(null);
    const [open, setOpen] = useState(false);
    const { showNotification } = useNotification();
    const confirm = useConfirm();

    const loadNotifications = async () => {
        setIsLoading(true);
        try {
            const list = await notificationService.list();
            setItems(list);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải thông báo",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
        userService
            .list()
            .then((response) => setUsers(response.payload))
            .catch(() => setUsers([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = items.filter(
        (item) =>
            `${item.title} ${item.content}`
                .toLowerCase()
                .includes(query.toLowerCase()) &&
            (status === "all" || item.status === status),
    );

    // Danh sách thông báo có thể tích lũy rất nhiều theo thời gian - phân
    // trang phía client trên kết quả đã lọc thay vì render toàn bộ.
    const {
        paginatedItems: paginatedNotifications,
        pagination: paginationMeta,
        setPage: setClientPage,
        setLimit: setClientLimit,
    } = useClientPagination(filtered, `${query}|${status}`);

    const save = async (data: {
        title: string;
        content: string;
        status: string;
        userIds?: number[];
    }) => {
        const ok = await confirm({
            title: editing ? "Xác nhận cập nhật thông báo" : "Xác nhận gửi thông báo",
            message: editing
                ? `Xác nhận lưu thay đổi cho thông báo "${data.title}"?`
                : `Xác nhận gửi thông báo "${data.title}" tới người nhận đã chọn?`,
            confirmText: editing ? "Lưu thay đổi" : "Gửi thông báo",
        });
        if (!ok) return;
        try {
            if (editing) {
                await notificationService.update(editing.id, {
                    title: data.title,
                    content: data.content,
                    status: data.status,
                });
            } else {
                await notificationService.send(data);
            }
            setOpen(false);
            setEditing(undefined);
            showNotification("Đã lưu thông báo.", "success");
            loadNotifications();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi lưu thông báo",
                "error",
            );
        }
    };

    const remove = async (item: SystemNotification) => {
        const ok = await confirm({
            title: "Xác nhận xóa thông báo",
            message: `Bạn có chắc muốn xóa thông báo "${item.title}" không? Hành động này không thể hoàn tác.`,
            confirmText: "Xóa",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await notificationService.remove(item.id);
            showNotification("Đã xóa thông báo.", "success");
            loadNotifications();
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi xóa thông báo",
                "error",
            );
        }
    };

    const editFromView = () => {
        if (!viewing) return;
        setEditing(viewing);
        setViewing(null);
        setOpen(true);
    };

    return (
        <>
        <PageMeta
        title={pageMeta.notifications.title}
        description={pageMeta.notifications.description}
        />
        <div className="p-6">
            <PageTitle
                title="Quản lý thông báo"
                action={
                    <button
                        onClick={() => {
                            setEditing(undefined);
                            setOpen(true);
                        }}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
                    >
                        Thêm thông báo
                    </button>
                }
            />
            <div className={`${panelClass} p-4`}>
                <div className="grid gap-3 md:grid-cols-3">
                    <SearchBox value={query} onChange={setQuery} />
                    <select
                        className={inputClass}
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Ẩn</option>
                    </select>
                </div>
                <TableHead
                    columns={["Tiêu đề", "Nội dung", "Trạng thái", "Ngày tạo", "Hành động"]}
                />
                {isLoading ? (
                    <EmptyState message="Đang tải thông báo..." />
                ) : filtered.length ? (
                    paginatedNotifications.map((item) => (
                        <div
                            className="grid grid-cols-5 gap-3 border-t p-4 text-sm dark:border-gray-800"
                            key={item.id}
                        >
                            <span>{item.title}</span>
                            <span className="truncate">{item.content}</span>
                            <span>{item.status === "active" ? "Hoạt động" : "Ẩn"}</span>
                            <span>{item.created_at}</span>
                            <Actions
                                onView={() => setViewing(item)}
                                onEdit={() => {
                                    setEditing(item);
                                    setOpen(true);
                                }}
                                onDelete={() => remove(item)}
                            />
                        </div>
                    ))
                ) : (
                    <EmptyState message="Không có thông báo phù hợp." />
                )}
                {!isLoading && filtered.length > 0 && (
                    <div className="p-4">
                        <Pagination
                            pagination={paginationMeta}
                            onPageChange={setClientPage}
                            onLimitChange={setClientLimit}
                        />
                    </div>
                )}
            </div>
            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                className="max-w-lg m-4 overflow-hidden dark:bg-gray-900"
            >
                <NotificationForm
                    initial={editing}
                    users={users}
                    onSave={save}
                    onCancel={() => setOpen(false)}
                />
            </Modal>
            <Modal
                isOpen={Boolean(viewing)}
                onClose={() => setViewing(null)}
                className="max-w-lg m-4 overflow-hidden dark:bg-gray-900"
            >
                {viewing && (
                    <DetailModal
                        title={viewing.title}
                        details={[
                            ["Nội dung", viewing.content],
                            ["Trạng thái", viewing.status === "active" ? "Hoạt động" : "Ẩn"],
                            ["Ngày tạo", viewing.created_at],
                        ]}
                        onEdit={editFromView}
                        onDelete={() => {
                            remove(viewing);
                            setViewing(null);
                        }}
                    />
                )}
            </Modal>
        </div>
        </>
    );
};

export default NotificationManagement;
