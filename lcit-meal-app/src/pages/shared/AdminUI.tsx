import React from "react";
import { inputClass } from "./adminUiStyles";

export const PageTitle: React.FC<{ title: string; action?: React.ReactNode }> = ({
    title,
    action,
}) => (
    <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">
            {title}
        </h2>
        {action}
    </div>
);

export const SearchBox: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder = "Tìm kiếm..." }) => (
    <input
        className={`${inputClass} max-w-sm`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
    />
);

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {message}
    </div>
);

export const FormActions: React.FC<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="flex justify-end gap-2">
        <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm"
        >
            Hủy
        </button>
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
            Lưu
        </button>
    </div>
);

export const Actions: React.FC<{
    onEdit: () => void;
    onDelete: () => void;
    onView?: () => void;
}> = ({ onEdit, onDelete, onView }) => (
    <div className="flex gap-2">
        {onView && (
            <button onClick={onView} className="rounded-lg border px-3 py-1 text-sm">
                Xem
            </button>
        )}
        <button onClick={onEdit} className="rounded-lg border px-3 py-1 text-sm">
            Sửa
        </button>
        <button
            onClick={onDelete}
            className="rounded-lg border px-3 py-1 text-sm text-red-600"
        >
            Xóa
        </button>
    </div>
);

export const TableHead: React.FC<{ columns: string[] }> = ({ columns }) => (
    <div className="mt-4 hidden grid-cols-5 gap-3 border-y bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 md:grid">
        {columns.map((column) => (
            <span key={column}>{column}</span>
        ))}
    </div>
);

export const Detail: React.FC<{ label: string; value: string }> = ({
    label,
    value,
}) => (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 font-medium text-gray-900 dark:text-white/90">{value}</p>
    </div>
);

export const DetailModal: React.FC<{
    title: string;
    details: [string, string][];
    onEdit: () => void;
    onDelete: () => void;
}> = ({ title, details, onEdit, onDelete }) => (
    <div className="space-y-4 bg-white p-6 dark:bg-gray-900">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chi tiết: {title}
        </h3>
        {details.map(([label, value]) => (
            <Detail key={label} label={label} value={value} />
        ))}
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border px-4 py-2 text-sm"
            >
                Sửa
            </button>
            <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border px-4 py-2 text-sm text-red-600"
            >
                Xóa
            </button>
        </div>
    </div>
);
