import MdiIcon from "../common/MdiIcon";

export type MealStatusVariant = "success" | "danger" | "info" | "neutral";

interface MealStatusProp {
    title: string;
    date: string;
    variant: MealStatusVariant;
    message: string;
    icon: string;
    price: string;
}

// Dùng object literal thay vì template literal `text-${color}-600` để Tailwind
// nhận diện đúng class khi build (className động ghép chuỗi sẽ bị purge mất).
const VARIANT_ICON_CLASS: Record<MealStatusVariant, string> = {
    success: "text-green-600",
    danger: "text-red-600",
    info: "text-blue-600",
    neutral: "text-gray-500",
};

const VARIANT_BADGE_CLASS: Record<MealStatusVariant, string> = {
    success: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    neutral: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

const VARIANT_TEXT_CLASS: Record<MealStatusVariant, string> = {
    success: "text-green-500",
    danger: "text-red-500",
    info: "text-blue-500",
    neutral: "text-gray-500",
};

const MealStatus: React.FC<MealStatusProp> = ({
    title,
    date,
    variant,
    message,
    icon,
    price,
}) => {
    return (
        <div className="rounded-xl border h-93 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] justify-center">
            {/* Tiêu đề */}
            <div>
                <h3 className="text-base font-semibold leading-6 text-gray-800 dark:text-white/90">
                    {title}
                </h3>

                <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">
                    {date}
                </p>
            </div>

            {/* Trạng thái */}
            <div className="mt-6 flex flex-col items-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <MdiIcon
                        path={icon}
                        size={1.5}
                        className={VARIANT_ICON_CLASS[variant]}
                    />
                </div>
                <span
                    className={`mt-3 rounded-full px-3 py-1 text-sm font-medium ${VARIANT_BADGE_CLASS[variant]}`}
                >
                    {message}
                </span>
            </div>

            {/* Đơn giá */}
            <div className="mt-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Đơn giá:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {price}đ
                    </span>{" "}
                    / suất
                </p>
            </div>

            {/* Thông báo */}
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <MdiIcon
                    path={icon}
                    size={0.65}
                    className={`shrink-0 ${VARIANT_TEXT_CLASS[variant]}`}
                />

                <span className={`text-center text-xs ${VARIANT_TEXT_CLASS[variant]}`}>
                    {message}
                </span>
            </div>
        </div>
    );
};

export default MealStatus;
