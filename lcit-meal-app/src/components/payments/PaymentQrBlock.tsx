import React from "react";
import { getSettingAssetUrl } from "@/api";
import { panelClass } from "@/pages/shared/adminUiStyles";

type Props = {
  title: string;
  // Đường dẫn ảnh QR đã cấu hình trong hệ thống (rỗng = chưa cấu hình)
  value: string;
};

// Khối hiển thị ảnh QR (thanh toán...) dùng ở các trang báo cáo/thanh toán.
const PaymentQrBlock: React.FC<Props> = ({ title, value }) => {
  const qrUrl = getSettingAssetUrl(value);

  return (
    <div className={`${panelClass} flex flex-col items-center p-5`}>
      <h3 className="mb-3 w-full font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="mt-3 flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-gray-300 p-2 dark:border-gray-700">
        {value ? (
          <img src={qrUrl} alt={title} className="h-full w-full object-contain" />
        ) : (
          <span className="text-center text-xs text-gray-500 dark:text-gray-400">
            Chưa cấu hình ảnh QR
          </span>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        {value
          ? "Quét mã để thanh toán"
          : "Vui lòng cấu hình QR trong phần cài đặt hệ thống"}
      </p>
    </div>
  );
};

export default PaymentQrBlock;
