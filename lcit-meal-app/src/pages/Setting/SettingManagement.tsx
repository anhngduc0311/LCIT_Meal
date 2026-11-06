import React, { useEffect, useState } from "react";
import { useNotification } from "@/hooks/useNotification";
import SettingForm from "@/components/settings/SettingForm";
import MealScheduleConfigPanel from "@/components/settings/MealScheduleConfigPanel";
import type { Setting } from "@/data/settings";
import { settingsService } from "@/api";
import { pageMeta } from "../PageMeta";
import PageMeta from "@/components/common/PageMeta";

const SettingManagement: React.FC = () => {
    const { showNotification } = useNotification();
    const [settings, setSettings] = useState<Setting[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const data = await settingsService.list();
                setSettings(data);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Lỗi khi tải cấu hình";
                showNotification(errorMessage, "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (updatedSettings: Setting[]) => {
        try {
            const saved = await settingsService.updateMany(
                updatedSettings.map((setting) => ({
                    setting_key: setting.setting_key,
                    setting_value: setting.setting_value,
                })),
            );
            setSettings(saved);
            showNotification("Cấu hình đã được lưu thành công!", "success");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Lỗi khi lưu cấu hình";
            showNotification(errorMessage, "error");
        }
    };

    return (
        <>
            <PageMeta
                title={pageMeta.settings.title}
                description={pageMeta.settings.description}
            />
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold dark:text-white/90">
                    Quản lý cấu hình hệ thống
                </h2>
            </div>

            {isLoading ? (
                <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
                    Đang tải cấu hình...
                </div>
            ) : (
                <SettingForm
                    settings={settings}
                    onSave={handleSave}
                />
            )}

            <MealScheduleConfigPanel />
        </>
    );
};

export default SettingManagement;
