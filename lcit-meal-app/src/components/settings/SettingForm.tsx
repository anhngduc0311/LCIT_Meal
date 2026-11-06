import React, { useState } from "react";

import type { Setting } from "@/data/settings";
import Switch from "../form/switch/Switch";
import MdiIcon from "../common/MdiIcon";
import FileInput from "../form/input/FileInput";
import { mdiClockOutline } from "@mdi/js";
import { settingsService, getSettingAssetUrl } from "@/api";

type Props = {
    settings: Setting[];
    onSave: (settings: Setting[]) => void;
};

const SettingForm: React.FC<Props> = ({ settings, onSave }) => {
    const [formValues, setFormValues] = useState<Record<string, any>>(
        settings.reduce((acc, setting) => {
            acc[setting.setting_key] = setting.setting_value;
            return acc;
        }, {} as Record<string, any>)
    );

    React.useEffect(() => {
        setFormValues(settings.reduce((acc, setting) => {
            acc[setting.setting_key] = setting.setting_value;
            return acc;
        }, {} as Record<string, any>));
    }, [settings]);

    const handleTimeChange = (key: string, value: string) => {
        setFormValues(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleToggleChange = (key: string, checked: boolean) => {
        setFormValues(prev => ({
            ...prev,
            [key]: checked
        }));
    };

    const handleQrChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
            const setting = await settingsService.uploadPaymentQr(file);
            setFormValues((prev) => ({ ...prev, payment_qr_image: setting.setting_value }));
        } catch {
            window.alert("Không thể tải ảnh QR lên.");
        }
    };

    const handleSave = () => {
        const updatedSettings = settings.map(setting => ({
            ...setting,
            setting_value: formValues[setting.setting_key]
        }));
        onSave(updatedSettings);
    };

    const renderSettingControl = (setting: Setting) => {
        const value = formValues[setting.setting_key];

        if (setting.setting_key === "payment_qr_image") {
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white/90">{setting.display_name}</label>
                    <FileInput
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleQrChange}
                        className="mt-2"
                    />
                    {value && <img src={getSettingAssetUrl(value)} alt="QR thanh toán" className="mt-3 h-44 w-44 rounded-lg border object-contain p-2" />}
                </div>
            );
        }

        // Check if it's a time input
        if (setting.data_type === "time" || setting.display_name.toLowerCase().includes("giờ")) {
            return (
                <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2 dark:text-white/90">
                        {setting.display_name}
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="time"
                            value={value || ""}
                            onChange={(e) => handleTimeChange(setting.setting_key, e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 w-full"
                        />
                        <MdiIcon path={mdiClockOutline} size={1} />
                    </div>
                </div>
            );
        }

        // For boolean/toggle settings using Switch component
        if (setting.data_type === "boolean" || typeof value === "boolean") {
            return (
                <div className="flex items-center justify-between h-full">
                    <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white/90">{setting.display_name}</p>
                    </div>
                    <Switch
                        label={value ? "Bật" : "Tắt"}
                        defaultChecked={value}
                        onChange={(checked) => handleToggleChange(setting.setting_key, checked)}
                    />
                </div>
            );
        }

        // Default text input
        return (
            <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white/90">
                    {setting.display_name}
                </label>
                <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => handleTimeChange(setting.setting_key, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>
        );
    };

    return (
        <div className="w-full p-4 mt-10">
            <div className=" rounded-xl border border-gray-200 p-6 shadow-sm">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 dark:text-white/90">
                        Cài đặt các thông số hệ thống
                    </h1>
                </div>

                {/* Settings List */}
                <div className="grid grid-cols-12 gap-4 lg:gap-6">
                    {settings.map((setting) => (
                        <div
                            key={setting.id}
                            className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors col-span-12 lg:col-span-6 space-y-6 dark:text-white/90"
                        >
                            {renderSettingControl(setting)}
                        </div>
                    ))}
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full mt-8 px-6 py-3 bg-brand-500 active:bg-orange-800 text-white font-semibold rounded-lg transition-colors shadow-sm hover:bg-brand-600"
                >
                    Lưu cài đặt
                </button>
            </div>
        </div>
    );
};

export default SettingForm;