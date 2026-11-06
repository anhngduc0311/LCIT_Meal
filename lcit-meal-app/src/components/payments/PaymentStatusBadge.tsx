import Badge from "../ui/badge/Badge";
import type { PaymentStatus } from "@/api";

const STATUS_BADGE: Record<
  PaymentStatus,
  { text: string; color: "success" | "error" | "warning" }
> = {
  paid: { text: "Đã thanh toán", color: "success" },
  overdue: { text: "Quá hạn", color: "error" },
  unpaid: { text: "Chưa thanh toán", color: "warning" },
};

// Nhãn trạng thái của 1 kỳ thanh toán (đã thanh toán / chưa thanh toán / quá hạn)
export default function PaymentStatusBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.unpaid;

  return (
    <Badge size="sm" color={badge.color}>
      {badge.text}
    </Badge>
  );
}
