import { Bell, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError, notificationService, type SystemNotification } from "@/api";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
};

export default function NotificationDropdown() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<SystemNotification[]>([]);
    const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
    const [unseenCount, setUnseenCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadNotifications = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [notifications, unseen] = await Promise.all([
                notificationService.listMine(),
                notificationService.getUnseenCount(),
            ]);
            setItems(notifications);
            setUnseenCount(unseen);
            setSeenIds(
                new Set(
                    notifications
                        .filter((notification) => notification.isSeen)
                        .map((notification) => notification.id),
                ),
            );
        } catch (error) {
            setErrorMessage(error instanceof ApiError ? error.message : "Không thể tải thông báo.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const toggleDropdown = () => {
        setIsOpen((open) => !open);
        if (!isOpen) void loadNotifications();
    };

    const handleNotificationClick = async (item: SystemNotification) => {
        try {
            if (!seenIds.has(item.id)) {
                await notificationService.markSeen(item.id);
                setSeenIds((current) => new Set(current).add(item.id));
                setUnseenCount((count) => Math.max(0, count - 1));
            }
            setIsOpen(false);
            navigate("/notification-management");
        } catch (error) {
            setErrorMessage(error instanceof ApiError ? error.message : "Không thể cập nhật thông báo.");
        }
    };

    const markAllAsSeen = async () => {
        if (!unseenCount) return;
        try {
            await notificationService.markAllSeen();
            setSeenIds(new Set(items.map((item) => item.id)));
            setUnseenCount(0);
        } catch (error) {
            setErrorMessage(error instanceof ApiError ? error.message : "Không thể cập nhật thông báo.");
        }
    };

    return (
        <div className="relative">
            <button type="button" aria-label={`Thông báo${unseenCount ? `, ${unseenCount} chưa đọc` : ""}`} onClick={toggleDropdown} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white">
                {unseenCount > 0 && <span className="absolute right-0 top-0.5 z-10 flex h-2 w-2 rounded-full bg-orange-400"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" /></span>}
                <Bell className="size-5" aria-hidden="true" />
            </button>
            <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0">
                <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
                    <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Thông báo{unseenCount > 0 && <span className="ml-2 text-sm text-brand-500">({unseenCount} mới)</span>}</h5>
                    <div className="flex items-center gap-2"><button type="button" aria-label="Tải lại thông báo" onClick={() => void loadNotifications()} disabled={isLoading} className="text-gray-500 disabled:opacity-50"><RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} /></button><button type="button" onClick={() => void markAllAsSeen()} disabled={!unseenCount || isLoading} className="text-xs text-brand-500 disabled:cursor-not-allowed disabled:opacity-50">Đánh dấu đã đọc</button></div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoading && <p className="p-6 text-center text-sm text-gray-500">Đang tải thông báo...</p>}
                    {!isLoading && errorMessage && <div className="space-y-3 p-6 text-center text-sm text-error-600"><p>{errorMessage}</p><button type="button" onClick={() => void loadNotifications()} className="rounded-lg border px-3 py-1 text-gray-700 dark:text-gray-300">Thử lại</button></div>}
                    {!isLoading && !errorMessage && items.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Chưa có thông báo.</p>}
                    {!isLoading && !errorMessage && items.map((item) => {
                        const isUnseen = !seenIds.has(item.id);
                        return (
                            <DropdownItem key={item.id} onItemClick={() => void handleNotificationClick(item)} className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${isUnseen ? "bg-blue-light-25 dark:bg-white/5" : ""}`}>
                                <span className={`mt-1 size-2 shrink-0 rounded-full ${isUnseen ? "bg-brand-500" : "bg-gray-300"}`} />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-800 dark:text-white/90">{item.title}</span>
                                    <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{item.content}</span>
                                    <span className="mt-1 block text-xs text-gray-400">{formatDate(item.created_at)}</span>
                                </span>
                            </DropdownItem>
                        );
                    })}
                </div>
                <Link to="/notification-management" onClick={() => setIsOpen(false)} className="mt-3 block rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">Xem tất cả thông báo</Link>
            </Dropdown>
        </div>
    );
}
