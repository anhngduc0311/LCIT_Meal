import { useState } from "react";
import {
    mdiCalendarCheckOutline,
    mdiCalendarRemoveOutline,
    mdiRefresh,
    mdiCalendarRange,
    mdiCreationOutline,
    mdiAccountMultiplePlusOutline,
} from "@mdi/js";

import MdiIcon from "../common/MdiIcon";
import MealActionButton from "../ui/button/MealActionButton";
import { Modal } from "../ui/modal";
import { useModal } from "@/hooks/useModal";
import { useConfirm } from "@/hooks/useConfirm";

export type MealQuickActionsProps = {
    // Ngày mà các thao tác bên dưới đang phục vụ (YYYY-MM-DD): hôm nay, hoặc
    // NGÀY KẾ TIẾP nếu đã qua giờ hoàn thành suất ăn (do backend quyết định).
    targetDate: string;
    // Cách gọi ngày đó trong câu chữ: "hôm nay" hoặc "ngày kế tiếp (01/10)"
    targetLabel: string;
    // true: đã qua giờ chốt đăng ký - đăng ký/cắt suất sẽ phải chờ quản lý duyệt
    needsApproval: boolean;
    // Giờ chốt đăng ký (HH:mm), dùng cho lời nhắc chờ duyệt
    closeTime?: string | null;
    // Có thể đăng ký lại suất ăn của ngày đang phục vụ hay không (bếp chưa hủy & chưa đăng ký)
    canRegister: boolean;
    // Có thể cắt suất của ngày đang phục vụ hay không (bếp chưa hủy & đang có đăng ký/chưa cắt)
    canCancelToday: boolean;
    // Có lịch bếp ăn ngày đang phục vụ hay không (để bật/tắt nút đăng ký suất cho khách)
    canRegisterGuest: boolean;
    // Số khách đang đăng ký cho ngày đang phục vụ (hiển thị trong form để sửa lại)
    currentGuestCount: number;
    isBusy: boolean;
    onRegisterToday: () => void;
    onCancelToday: () => void;
    onCancelPermanent: (note: string) => void;
    onCancelCustomRange: (fromDate: string, toDate: string, note: string) => void;
    // Đăng ký thêm suất ăn cho khách trong ngày đang phục vụ (không cần duyệt)
    onRegisterGuest: (guestCount: number) => void;
};

// Khớp với MAX_GUEST_PER_REGISTRATION ở backend
// (src/services/MealRegistrationService.js)
const MAX_GUEST = 10;

const MealQuickActions: React.FC<MealQuickActionsProps> = ({
    targetDate,
    targetLabel,
    needsApproval,
    closeTime,
    canRegister,
    canCancelToday,
    canRegisterGuest,
    currentGuestCount,
    isBusy,
    onRegisterToday,
    onCancelToday,
    onCancelPermanent,
    onCancelCustomRange,
    onRegisterGuest,
}) => {
    const { isOpen, openModal, closeModal } = useModal(false);
    const guestModal = useModal(false);
    const confirm = useConfirm();
    const [fromDate, setFromDate] = useState(targetDate);
    const [toDate, setToDate] = useState(targetDate);
    const [note, setNote] = useState("");
    const [guestCount, setGuestCount] = useState(1);

    const openGuestModal = () => {
        // Mặc định hiển thị số khách đang đăng ký; nếu chưa có khách nào thì
        // gợi ý 1 để người dùng bấm xác nhận là xong.
        setGuestCount(currentGuestCount > 0 ? currentGuestCount : 1);
        guestModal.openModal();
    };

    // Mở form cắt tùy chỉnh với mặc định là ngày đang phục vụ (có thể đã đổi
    // sang ngày kế tiếp sau khi trang tải xong cửa sổ đăng ký).
    const openCustomRangeModal = () => {
        setFromDate(targetDate);
        setToDate(targetDate);
        openModal();
    };

    const handleSubmitGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        // Không đổi gì thì đóng luôn - gọi API lúc này backend sẽ báo "đã
        // đăng ký suất ăn này rồi", gây khó hiểu trong ngữ cảnh thêm khách.
        if (guestCount === currentGuestCount) {
            guestModal.closeModal();
            return;
        }
        const ok = await confirm({
            title: "Xác nhận đăng ký suất ăn cho khách",
            message:
                guestCount > 0
                    ? `Bạn có chắc chắn muốn đăng ký thêm ${guestCount} suất ăn cho khách ${targetLabel}?`
                    : `Bạn có chắc chắn muốn bỏ toàn bộ suất ăn đã đăng ký cho khách ${targetLabel}?`,
            confirmText: "Xác nhận",
        });
        if (!ok) return;
        onRegisterGuest(guestCount);
        guestModal.closeModal();
    };

    const handleSubmitCustomRange = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await confirm({
            title: "Xác nhận cắt suất ăn theo khoảng ngày",
            message: needsApproval && fromDate === targetDate
                ? `Đã quá giờ chốt đăng ký${closeTime ? ` (${closeTime})` : ""}. Yêu cầu cắt suất ăn từ ${fromDate} đến ${toDate} sẽ được gửi cho quản lý duyệt. Tiếp tục?`
                : `Bạn có chắc chắn muốn cắt suất ăn từ ${fromDate} đến ${toDate}? Suất ăn sẽ được cắt ngay sau khi xác nhận.`,
            confirmText: "Cắt suất ăn",
            variant: "danger",
        });
        if (!ok) return;
        onCancelCustomRange(fromDate, toDate, note);
        closeModal();
        setNote("");
    };

    const handleCancelPermanent = async () => {
        const note = window.prompt("Lý do cắt hẳn suất ăn (tùy chọn):", "");
        if (note === null) return; // người dùng bấm Hủy
        const ok = await confirm({
            title: "Xác nhận cắt hẳn suất ăn",
            message: needsApproval
                ? `Đã quá giờ chốt đăng ký${closeTime ? ` (${closeTime})` : ""}. Yêu cầu cắt hẳn suất ăn kể từ ${targetLabel} sẽ được gửi cho quản lý duyệt. Tiếp tục?`
                : `Bạn có chắc chắn muốn cắt hẳn suất ăn kể từ ${targetLabel}? Suất ăn sẽ được cắt ngay và áp dụng cho đến khi bạn được quản lý xác nhận đăng ký ăn lại.`,
            confirmText: "Cắt hẳn",
            variant: "danger",
        });
        if (!ok) return;
        onCancelPermanent(note);
    };

    return (
        <div className="w-full min-h-70 rounded-xl flex flex-col justify-between border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 px-5 py-10">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2">
                    <MdiIcon
                        path={mdiCreationOutline}
                        size={0.8}
                        className="text-gray-700 dark:text-white/90"
                    />
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                        Tùy chọn nhanh
                    </h3>
                </div>
                <p className="mt-0.5 text-sm text-[#806d5c]">
                    Đăng ký suất ăn, hoặc cắt suất theo các lựa chọn nhanh bên dưới
                    — áp dụng cho <span className="font-semibold">{targetLabel}</span>
                </p>
                {needsApproval && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        Đã quá giờ chốt đăng ký{closeTime ? ` (${closeTime})` : ""}. Đăng ký hoặc
                        cắt suất {targetLabel} sẽ được gửi cho quản lý duyệt trước khi có hiệu lực.
                    </p>
                )}
            </div>

            {/* Buttons */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Đăng ký lại */}
                <MealActionButton
                    variant={canRegister ? "primary" : "disabled"}
                    disabled={!canRegister || isBusy}
                    startIcon={
                        <MdiIcon
                            path={mdiCalendarCheckOutline}
                            size={0.85}
                            className="text-white"
                        />
                    }
                    onClick={onRegisterToday}
                >
                    <span className="text-sm font-semibold">
                        Đăng ký lại suất ăn
                    </span>

                    <span className="text-xs text-white/90">
                        {needsApproval ? "Gửi yêu cầu đăng ký" : "Đăng ký suất ăn"} cho {targetLabel}
                    </span>
                </MealActionButton>

                {/* Cắt hôm nay */}
                <MealActionButton
                    variant={canCancelToday ? "danger" : "disabled"}
                    disabled={!canCancelToday || isBusy}
                    startIcon={
                        <MdiIcon
                            path={mdiCalendarRemoveOutline}
                            size={0.85}
                            className="text-[#d96c55]"
                        />
                    }
                    onClick={onCancelToday}
                >
                    <span className="text-sm font-semibold text-[#d96c55]">
                        Cắt — Chỉ {targetLabel}
                    </span>

                    <span className="text-xs text-[#d9a89c]">
                        {needsApproval
                            ? "Gửi yêu cầu cắt, chờ quản lý duyệt"
                            : "Các ngày sau vẫn giữ nguyên đăng ký"}
                    </span>
                </MealActionButton>

                {/* Cắt hẳn */}
                <MealActionButton
                    variant="danger"
                    disabled={isBusy}
                    startIcon={
                        <MdiIcon
                            path={mdiRefresh}
                            size={0.85}
                            className="text-[#d84b32]"
                        />
                    }
                    onClick={handleCancelPermanent}
                >
                    <span className="text-sm font-semibold">
                        Cắt hẳn từ {targetLabel}
                    </span>

                    <span className="text-xs text-[#a85b4a]">
                        Áp dụng tới khi đăng ký ăn lại
                    </span>
                </MealActionButton>

                {/* Cắt tùy chỉnh */}
                <MealActionButton
                    variant="outline"
                    disabled={isBusy}
                    startIcon={
                        <MdiIcon
                            path={mdiCalendarRange}
                            size={0.85}
                            className="text-gray-700"
                        />
                    }
                    onClick={openCustomRangeModal}
                >
                    <span className="text-sm font-semibold">
                        Cắt suất tùy chỉnh
                    </span>

                    <span className="text-xs text-gray-600">
                        Chọn khoảng ngày được phép cắt
                    </span>
                </MealActionButton>

                {/* Đăng ký suất cho khách - không cần quản lý duyệt */}
                <div className="md:col-span-2">
                    <MealActionButton
                        variant={canRegisterGuest ? "outline" : "disabled"}
                        disabled={!canRegisterGuest || isBusy}
                        startIcon={
                            <MdiIcon
                                path={mdiAccountMultiplePlusOutline}
                                size={0.85}
                                className="text-gray-700"
                            />
                        }
                        onClick={openGuestModal}
                    >
                        <span className="text-sm font-semibold">
                            Đăng ký suất ăn cho khách
                        </span>

                        <span className="text-xs text-gray-600">
                            {currentGuestCount > 0
                                ? `Đang đăng ký ${currentGuestCount} suất khách cho ${targetLabel}`
                                : `Thêm suất cho khách ${targetLabel}`}
                        </span>
                    </MealActionButton>
                </div>
            </div>

            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                className="max-w-md m-4 overflow-hidden dark:bg-gray-900"
            >
                <form
                    onSubmit={handleSubmitCustomRange}
                    className="space-y-4 bg-white p-6 dark:bg-gray-900"
                >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Cắt suất ăn theo khoảng ngày
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Suất ăn trong khoảng ngày này sẽ được cắt ngay sau khi bạn xác nhận.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Từ ngày
                            </label>
                            <input
                                type="date"
                                required
                                value={fromDate}
                                min={targetDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Đến ngày
                            </label>
                            <input
                                type="date"
                                required
                                value={toDate}
                                min={fromDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Lý do (tùy chọn)
                        </label>
                        <textarea
                            rows={3}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Vd: Đi công tác"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
                        >
                            Cắt suất ăn
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal đăng ký suất ăn cho khách */}
            <Modal
                isOpen={guestModal.isOpen}
                onClose={guestModal.closeModal}
                className="max-w-md m-4 overflow-hidden dark:bg-gray-900"
            >
                <form
                    onSubmit={handleSubmitGuest}
                    className="space-y-4 bg-white p-6 dark:bg-gray-900"
                >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Đăng ký suất ăn cho khách
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Suất ăn cho khách được xác nhận ngay, không cần quản lý duyệt.
                        Nhập 0 nếu muốn bỏ toàn bộ suất khách đã đăng ký.
                    </p>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Số suất cho khách (tối đa {MAX_GUEST})
                        </label>
                        <input
                            type="number"
                            required
                            min={0}
                            max={MAX_GUEST}
                            value={guestCount}
                            onChange={(e) =>
                                setGuestCount(
                                    Math.max(
                                        0,
                                        Math.min(MAX_GUEST, Number(e.target.value) || 0),
                                    ),
                                )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={guestModal.closeModal}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isBusy}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                            Xác nhận
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default MealQuickActions;
