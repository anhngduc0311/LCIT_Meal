import React, { useEffect, useState } from "react";
import Switch from "../form/switch/Switch";
import { useNotification } from "@/hooks/useNotification";
import {
    mealScheduleConfigService,
    ApiError,
    type MealScheduleDay,
} from "@/api";

// 0 = Chủ Nhật ... 6 = Thứ Bảy - khớp với `day_of_week` ở backend.
const DAY_LABELS: Record<number, string> = {
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    0: "Chủ Nhật",
};

// Thứ tự hiển thị: T2 -> CN (thay vì 0..6) cho tự nhiên với người dùng VN.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const MealScheduleConfigPanel: React.FC = () => {
    const { showNotification } = useNotification();
    const [days, setDays] = useState<MealScheduleDay[]>([]);
    const [useMealConfig, setUseMealConfig] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            const data = await mealScheduleConfigService.get();
            setDays(data.days);
            setUseMealConfig(data.useMealConfig);
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi tải cấu hình ngày ăn trong tuần",
                "error",
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleDay = (dayOfWeek: number) => {
        setDays((prev) =>
            prev.map((day) =>
                day.dayOfWeek === dayOfWeek
                    ? { ...day, isEnabled: !day.isEnabled }
                    : day,
            ),
        );
    };

    const handleSave = async () => {
        if (days.length > 0 && days.every((day) => !day.isEnabled)) {
            showNotification("Phải chọn ít nhất 1 ngày trong tuần có bố trí suất ăn.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const updated = await mealScheduleConfigService.update({
                days: days.map((day) => ({
                    dayOfWeek: day.dayOfWeek,
                    isEnabled: day.isEnabled,
                    notes: day.notes ?? undefined,
                })),
                useMealConfig,
            });
            setDays(updated.days);
            setUseMealConfig(updated.useMealConfig);
            showNotification("Đã lưu cấu hình ngày ăn trong tuần.", "success");
        } catch (error) {
            showNotification(
                error instanceof ApiError ? error.message : "Lỗi khi lưu cấu hình ngày ăn trong tuần",
                "error",
            );
        } finally {
            setIsSaving(false);
        }
    };

    const sortedDays = DAY_ORDER.map((dow) =>
        days.find((day) => day.dayOfWeek === dow),
    ).filter((day): day is MealScheduleDay => Boolean(day));

    return (
        <div className="w-full p-4">
            <div className="rounded-xl border border-gray-200 p-6 shadow-sm dark:border-gray-700">
                <div className="mb-6 flex flex-col gap-1">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">
                        Các ngày ăn trong tuần
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Chọn những thứ trong tuần có bố trí suất ăn. Hệ thống tự động tạo lịch/đăng ký ăn hàng ngày
                        sẽ chỉ tạo bếp ăn cho các ngày được bật ở đây (mặc định Thứ 2 - Thứ 6, không tạo vào
                        Thứ 7 và Chủ Nhật).
                    </p>
                </div>

                {isLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải cấu hình...</p>
                ) : (
                    <>
                        <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white/90">
                                    Áp dụng cấu hình này cho job tự động tạo lịch ăn
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Nếu tắt, hệ thống sẽ tạo bếp ăn cho tất cả các ngày trong tháng, kể cả Thứ 7 và
                                    Chủ Nhật (bỏ qua cấu hình bên dưới).
                                </p>
                            </div>
                            <Switch
                                key={`use-meal-config-${useMealConfig}`}
                                label={useMealConfig ? "Bật" : "Tắt"}
                                defaultChecked={useMealConfig}
                                onChange={setUseMealConfig}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                            {sortedDays.map((day) => (
                                <button
                                    type="button"
                                    key={day.dayOfWeek}
                                    onClick={() => toggleDay(day.dayOfWeek)}
                                    disabled={!useMealConfig}
                                    className={`rounded-lg border-2 px-3 py-4 text-center text-sm font-medium transition disabled:opacity-50 ${
                                        day.isEnabled
                                            ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                                            : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                                    }`}
                                >
                                    {DAY_LABELS[day.dayOfWeek]}
                                    <div className="mt-1 text-xs">
                                        {day.isEnabled ? "Có ăn" : "Không ăn"}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="mt-8 w-full rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 active:bg-orange-800 disabled:opacity-60"
                        >
                            {isSaving ? "Đang lưu..." : "Lưu cấu hình ngày ăn"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default MealScheduleConfigPanel;
