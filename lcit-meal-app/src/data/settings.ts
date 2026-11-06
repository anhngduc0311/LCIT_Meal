export type Setting = {
  id: string;
  setting_key: string;
  setting_value: string;
  display_name: string;
  data_type: string;
  description: string;
  updated_at: string;
  updated_by: string;
};

// Sample data dump: 12 users
export const sampleSettings: Setting[] = [
  {
    id: "1",
    setting_key: "registration_close_time",
    setting_value: "08:30",
    display_name: "Thời gian đóng đăng ký",
    data_type: "time",
    description: "Giờ đăng ký hủy suất trong ngày (HH:mm)",
    updated_at: "2026-01-12",
    updated_by: "Nguyen Van A",
  },
  {
    id: "2",
    setting_key: "meal_price",
    setting_value: "35000",
    display_name: "Giá tiền suất ăn",
    data_type: "integer",
    description: "Đơn giá một suất ăn (VNĐ)",
    updated_at: "2026-01-12",
    updated_by: "Nguyen Van A",
  },
  {
    id: "1",
    setting_key: "guest_meal_price",
    setting_value: "40000",
    display_name: "Giá tiền suất ăn (khách)",
    data_type: "integer",
    description: "Đơn giá một suất ăn (khách mời)",
    updated_at: "2026-01-12",
    updated_by: "Nguyen Van A",
  },
  {
    id: "1",
    setting_key: "auto_register_enabled",
    setting_value: "1",
    display_name: "Tự động đăng ký",
    data_type: "boolean",
    description: "Bật/tắt tự động đăng ký ăn theo lịch mặc định",
    updated_at: "2026-01-12",
    updated_by: "Nguyen Van A",
  },
  {
    id: "1",
    setting_key: "max_guest_per_registration",
    setting_value: "3",
    display_name: "Số lượng khách tối đa",
    data_type: "integer",
    description: "Số lượng khách tối đa được đăng ký kèm trong một lượt",
    updated_at: "2026-01-12",
    updated_by: "Nguyen Van A",
  },
];
