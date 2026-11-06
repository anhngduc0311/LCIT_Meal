import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useNotification } from "@/hooks/useNotification";
import { auditLogService, ApiError, type AuditLog } from "@/api";
import { inputClass, panelClass } from "../shared/adminUiStyles";
import { PageTitle, SearchBox, EmptyState, TableHead, Detail } from "../shared/AdminUI";
import PageMeta from "@/components/common/PageMeta";
import { pageMeta } from "../PageMeta";
import { useClientPagination } from "@/hooks/useClientPagination";
import Pagination from "@/components/common/Pagination";

const AuditLogManagement: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [actor, setActor] = useState("all");
    const [action, setAction] = useState("all");
    const [date, setDate] = useState("");
    const [viewing, setViewing] = useState<AuditLog | null>(null);
    const { showNotification } = useNotification();

    useEffect(() => {
        auditLogService
            .list()
            .then(setLogs)
            .catch((error) => {
                showNotification(
                    error instanceof ApiError ? error.message : "Lỗi khi tải lịch sử hệ thống",
                    "error",
                );
            })
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = logs.filter(
        (item) =>
            `${item.actor_name ?? ""} ${item.log_action} ${item.log_target ?? ""} ${item.log_detail ?? ""}`
                .toLowerCase()
                .includes(query.toLowerCase()) &&
            (actor === "all" || item.actor_name === actor) &&
            (action === "all" || item.log_action === action) &&
            (!date || item.log_time.startsWith(date)),
    );

    // Phân trang phía client trên kết quả đã lọc (danh sách lịch sử hệ
    // thống có thể rất lớn theo thời gian - bảng chỉ hiển thị 1 trang tại
    // 1 thời điểm thay vì render toàn bộ).
    const {
        paginatedItems: paginatedLogs,
        pagination: paginationMeta,
        setPage: setClientPage,
        setLimit: setClientLimit,
    } = useClientPagination(filtered, `${query}|${actor}|${action}|${date}`);

    return (
        <>
            <PageMeta
                title={pageMeta.systemHistory.title}
                description={pageMeta.systemHistory.description}
            />
            <div className="p-6">
                <PageTitle title="Lịch sử hệ thống" />
                <div className={`${panelClass} p-4`}>
                    <div className="grid gap-3 md:grid-cols-4">
                        <SearchBox
                            value={query}
                            onChange={setQuery}
                            placeholder="Tìm trong lịch sử"
                        />
                        <select
                            className={inputClass}
                            value={actor}
                            onChange={(event) => setActor(event.target.value)}
                        >
                            <option value="all">Tất cả người thao tác</option>
                            {[...new Set(logs.map((item) => item.actor_name).filter(Boolean))].map((name) => (
                                <option value={name as string} key={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <select
                            className={inputClass}
                            value={action}
                            onChange={(event) => setAction(event.target.value)}
                        >
                            <option value="all">Tất cả hành động</option>
                            {[...new Set(logs.map((item) => item.log_action))].map((name) => (
                                <option value={name} key={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <input
                            className={inputClass}
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                        />
                    </div>
                    <TableHead
                        columns={[
                            "Thời gian",
                            "Người thao tác",
                            "Hành động",
                            "Đối tượng",
                            "Chi tiết",
                        ]}
                    />
                    {isLoading ? (
                        <EmptyState message="Đang tải lịch sử..." />
                    ) : paginatedLogs.length ? (
                        paginatedLogs.map((item) => (
                            <div
                                className="grid grid-cols-5 gap-3 border-t p-4 text-sm dark:border-gray-800"
                                key={item.id}
                            >
                                <span>{item.log_time}</span>
                                <span>{item.actor_name ?? "Hệ thống"}</span>
                                <span>{item.log_action}</span>
                                <span>{item.log_target}</span>
                                <button
                                    className="text-left text-brand-500"
                                    onClick={() => setViewing(item)}
                                >
                                    {item.log_detail}
                                </button>
                            </div>
                        ))
                    ) : (
                        <EmptyState message="Không có lịch sử phù hợp." />
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
                    isOpen={Boolean(viewing)}
                    onClose={() => setViewing(null)}
                    className="max-w-lg m-4 overflow-hidden dark:bg-gray-900"
                >
                    {viewing && (
                        <div className="space-y-4 bg-white p-6 dark:bg-gray-900">
                            <h3 className="text-lg font-semibold dark:text-white">
                                Chi tiết lịch sử
                            </h3>
                            <Detail label="Thời gian" value={viewing.log_time} />
                            <Detail label="Người thao tác" value={viewing.actor_name ?? "Hệ thống"} />
                            <Detail
                                label="Hành động"
                                value={`${viewing.log_action} ${viewing.log_target ?? ""}`}
                            />
                            <Detail label="Nội dung" value={viewing.log_detail ?? ""} />
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );
};

export default AuditLogManagement;
