import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationContext, type NotificationStatus } from "./NotificationContext";

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<{ message: string; status: NotificationStatus } | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hideNotification = useCallback(() => {
        setNotification(null);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const showNotification = useCallback(
        (message: string, status: NotificationStatus = "info") => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setNotification({ message, status });
            timeoutRef.current = setTimeout(hideNotification, 4000);
        },
        [hideNotification],
    );

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    return (
        <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};