import React from "react";
import Select from "../form/Select";

type Props = {
    q: string;
    role: string;
    status: string;
    onChange: (changes: Partial<{ q: string; role: string; status: string }>) => void;
};

const roleOptions = [
    { value: "", label: "Tất cả quyền" },
    { value: "employee", label: "Nhân viên" },
    { value: "manager", label: "Quản lý danh sách" },
    { value: "admin", label: "Quản trị" }
];

const statusOptions = [
    { value: "", label: "Tất cả" },
    { value: "1", label: "Hoạt động" },
    { value: "0", label: "Dừng hoạt động" }
]

const UserFilters: React.FC<Props> = ({ q, role, status, onChange }) => {
    return (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between p-4">
            <div className="flex gap-2 w-full sm:w-1/2">
                <input value={q} onChange={(e) => onChange({ q: e.target.value })} placeholder="Tìm theo tên hoặc email" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 dark:text-white/90" />
                <button onClick={() => onChange({ q: "", role: "", status: "" })} className="px-3 py-2 rounded-lg border">Clear</button>
            </div>

            <div className="flex gap-2">
                <Select
                    options={roleOptions}
                    placeholder="Chọn quyền"
                    value={role}
                    onChange={(value) => onChange({ role: value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <Select
                    options={statusOptions}
                    placeholder="Chọn trạng thái"
                    value={status}
                    onChange={(value) => onChange({ status: value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                />
            </div>
        </div>
    );
};

export default UserFilters;
