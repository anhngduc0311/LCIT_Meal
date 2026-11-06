import { ReactNode } from "react";

interface MealActionButtonProps {
    children: ReactNode;
    variant?: "primary" | "danger" | "outline" | "disabled";
    startIcon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}

const MealActionButton: React.FC<MealActionButtonProps> = ({
    children,
    variant = "outline",
    startIcon,
    onClick,
    disabled = false,
    className = "",
}) => {
    const variantClasses = {
        primary:
            "border-[#d47700] bg-brand-500 text-white " +
            "hover:bg-[#e18408] " +
            "dark:border-[#b96500] dark:bg-[#b96500] dark:text-white " +
            "dark:hover:bg-[#d47700]",

        danger:
            "border-[#edc7bd] bg-white text-[#d84b32] hover:bg-[#fff5f2] " +
            "dark:border-[#6b3930] dark:bg-[#241a18] dark:text-[#f28b78] " +
            "dark:hover:border-[#87483d] dark:hover:bg-[#30201d]",

        outline:
            "border-[#dfcfbb] bg-white text-gray-800 hover:bg-[#faf6f0] " +
            "dark:border-[#4a4036] dark:bg-[#1c1917] dark:text-gray-200 " +
            "dark:hover:border-[#665545] dark:hover:bg-[#25211d]",

        disabled:
            "cursor-not-allowed border-[#eadbd5] bg-white text-[#d9a89c] " +
            "dark:border-[#39302d] dark:bg-[#181615] dark:text-[#80645d]",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
        flex
        min-h-[64px]
        w-full
        items-center
        justify-start
        gap-3
        rounded-lg
        border
        px-5
        py-3
        text-left
        transition-colors
        duration-200
        ${variantClasses[variant]}
        ${disabled ? "cursor-not-allowed opacity-60" : ""}
        ${className}
      `}
        >
            {startIcon && (
                <span className="flex shrink-0 items-center">
                    {startIcon}
                </span>
            )}

            <span className="flex min-w-0 flex-col">
                {children}
            </span>
        </button>
    );
};

export default MealActionButton;