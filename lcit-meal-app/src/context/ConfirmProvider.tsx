import { useCallback, useRef, useState } from "react";
import { ConfirmContext, type ConfirmOptions } from "./ConfirmContext";
import ConfirmDialog from "@/components/ui/modal/ConfirmDialog";

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    // Dùng ref thay vì state cho resolver vì đây không phải giá trị cần
    // render lại UI - chỉ là 1 callback tạm giữ để "trả lời" Promise đang
    // chờ khi người dùng bấm xác nhận/hủy.
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions) => {
        setOptions(opts);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const settle = (result: boolean) => {
        setOptions(null);
        resolverRef.current?.(result);
        resolverRef.current = null;
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmDialog
                isOpen={options !== null}
                title={options?.title}
                message={options?.message ?? ""}
                confirmText={options?.confirmText}
                cancelText={options?.cancelText}
                variant={options?.variant}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        </ConfirmContext.Provider>
    );
};
