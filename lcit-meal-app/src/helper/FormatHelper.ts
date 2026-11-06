// Định dạng tiền: 35000 -> "35.000đ". null/undefined -> "-"
export const formatCurrency = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") return "-";
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))}đ`;
};

// "2026-09" hoặc "2026-09-30" -> "Tháng 09/2026"
export const formatMonthYear = (value: string): string => {
  if (!value || value.length < 7) return value;
  return `Tháng ${value.slice(5, 7)}/${value.slice(0, 4)}`;
};
