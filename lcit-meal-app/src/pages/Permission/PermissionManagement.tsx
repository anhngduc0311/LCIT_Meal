import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useNotification } from "@/hooks/useNotification";
import { useConfirm } from "@/hooks/useConfirm";
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
import { pageMeta } from "../PageMeta";
import PageMeta from "@/components/common/PageMeta";

type Permission = {
    id: string;
    name: string;
    description: string;
    scope: string;
    updatedAt: string;
};

const samplePermissions: Permission[] = [
    {
        id: "p1",
        name: "Quản trị hệ thống",
        description: "Toàn quyền quản lý dữ liệu và cấu hình.",
        scope: "Tất cả",
        updatedAt: "2026-08-20",
    },
    {
        id: "p2",
        name: "Quản lý suất ăn",
        description: "Đăng ký, điều chỉnh và xem lịch suất ăn.",
        scope: "Suất ăn",
        updatedAt: "2026-08-18",
    },
    {
        id: "p3",
        name: "Kế toán",
        description: "Theo dõi và đối soát thanh toán.",
        scope: "Thanh toán",
        updatedAt: "2026-08-12",
    },
];

const PermissionForm: React.FC<{
    initial?: Permission;
    onSave: (permission: Permission) => void;
    onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [scope, setScope] = useState(initial?.scope ?? "");
    return (
        <form
            className="space-y-4 bg-white p-6 dark:bg-gray-900"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({
                    id: initial?.id ?? `p${Date.now()}`,
                    name,
                    description,
                    scope,
                    updatedAt: new Date().toISOString().slice(0, 10),
                });
            }}
        >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {initial ? "Sửa quyền hệ thống" : "Thêm quyền hệ thống"}
            </h3>
            <input
                className={inputClass}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tên quyền"
            />
            <textarea
                className={inputClass}
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Mô tả"
                rows={3}
            />
            <input
                className={inputClass}
                required
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                placeholder="Phạm vi áp dụng"
            />
            <FormActions onCancel={onCancel} />
        </form>
    );
};

const PermissionManagement: React.FC = () => {
    const [items, setItems] = useState(samplePermissions);
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<Permission | undefined>();
    const [open, setOpen] = useState(false);
    const [viewing, setViewing] = useState<Permission | null>(null);
    const { showNotification } = useNotification();
    const confirm = useConfirm();
    const filtered = items.filter((item) =>
        `${item.name} ${item.description} ${item.scope}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const save = async (item: Permission) => {
        const isNew = !items.some((entry) => entry.id === item.id);
        const ok = await confirm({
            title: isNew ? "Xác nhận thêm quyền" : "Xác nhận cập nhật quyền",
            message: isNew
                ? `Xác nhận thêm quyền mới "${item.name}"?`
                : `Xác nhận lưu thay đổi cho quyền "${item.name}"?`,
            confirmText: isNew ? "Thêm" : "Lưu thay đổi",
        });
        if (!ok) return;
        setItems((current) =>
            current.some((entry) => entry.id === item.id)
                ? current.map((entry) => (entry.id === item.id ? item : entry))
                : [item, ...current],
        );
        setOpen(false);
        showNotification("Đã lưu quyền hệ thống.", "success");
    };
    const remove = async (item: Permission) => {
        const ok = await confirm({
            title: "Xác nhận xóa quyền",
            message: `Bạn có chắc muốn xóa quyền "${item.name}" không? Hành động này không thể hoàn tác.`,
            confirmText: "Xóa",
            variant: "danger",
        });
        if (!ok) return;
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        showNotification("Đã xóa quyền.", "success");
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
            title={pageMeta.permissions.title}
            description={pageMeta.permissions.description}
        />
            <div className="p-6">
                <PageTitle
                    title="Quản lý quyền hệ thống"
                    action={
                        <button
                            onClick={() => {
                                setEditing(undefined);
                                setOpen(true);
                            }}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
                        >
                            Thêm quyền
                        </button>
                    }
                />
                <div className={`${panelClass} p-4`}>
                    <SearchBox
                        value={query}
                        onChange={setQuery}
                        placeholder="Tìm theo tên hoặc phạm vi"
                    />
                    <TableHead
                        columns={["Tên quyền", "Mô tả", "Phạm vi", "Cập nhật", "Hành động"]}
                    />
                    {filtered.length ? (
                        filtered.map((item) => (
                            <div
                                className="grid grid-cols-5 gap-3 border-t p-4 text-sm dark:border-gray-800"
                                key={item.id}
                            >
                                <span>{item.name}</span>
                                <span>{item.description}</span>
                                <span>{item.scope}</span>
                                <span>{item.updatedAt}</span>
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
                        <EmptyState message="Không có quyền phù hợp." />
                    )}
                </div>
                <Modal
                    isOpen={open}
                    onClose={() => setOpen(false)}
                    className="max-w-lg m-4 overflow-hidden dark:bg-gray-900"
                >
                    <PermissionForm
                        initial={editing}
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
                            title={viewing.name}
                            details={[
                                ["Mô tả", viewing.description],
                                ["Phạm vi", viewing.scope],
                                ["Cập nhật", viewing.updatedAt],
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

export default PermissionManagement;
