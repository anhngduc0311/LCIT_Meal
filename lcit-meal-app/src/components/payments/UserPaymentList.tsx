import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import type { PaymentListItem } from "@/api";
import { formatDate } from "@/helper/DateHelper";

type Props = {
  payments: PaymentListItem[];
};

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))}đ`;
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case "paid":
      return { text: "Đã thanh toán", color: "success" as const };
    case "overdue":
      return { text: "Quá hạn", color: "error" as const };
    case "unpaid":
      return { text: "Chưa thanh toán", color: "warning" as const };
    default:
      return { text: "Chưa có kỳ thu", color: "light" as const };
  }
};

export default function UserPaymentList({ payments }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/3 sm:px-6">

      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Tình trạng thanh toán
          </h3>
        </div>
      </div>
      <div className="max-w-full h-120 overflow-x-auto overflow-y-auto">
        <Table>
          {/* Table Header */}
          <TableHeader className="sticky top-0 z-10 border-gray-300 dark:border-gray-800 border-y bg-white dark:bg-gray-900">
            <TableRow>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-300"
              >
                Cán bộ
              </TableCell>

              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Kỳ gần nhất
              </TableCell>

              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Số tiền
              </TableCell>

              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Trạng thái thanh toán
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}
          <TableBody className="divide-y divide-gray-300 dark:divide-gray-300">
            {payments.length === 0 && (
              <TableRow>
                <TableCell className="py-6 text-center font-medium text-gray-500 text-theme-sm dark:text-gray-400">
                  Chưa có dữ liệu thanh toán.
                </TableCell>
              </TableRow>
            )}
            {payments.map((payment) => {
              const status = statusLabel(payment.payment_status);
              return (
                <TableRow key={payment.user_id}>
                  <TableCell className="py-3 text-gray-500 text-theme-xs dark:text-gray-400">
                    <p className="line-clamp-1 max-w-30" title={payment.full_name}>{payment.full_name}</p>
                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-xs dark:text-gray-400">
                    <p className="line-clamp-1 max-w-20">
                      {formatDate(payment.payment_date) ?? "-"}
                    </p>
                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-xs dark:text-gray-400">
                    <p className="line-clamp-1 max-w-20">
                      {formatCurrency(payment.amount)}
                    </p>
                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-xs dark:text-gray-400">
                    <Badge size="sm" color={status.color}>
                      <p className="line-clamp-1 max-w-30">
                        {status.text}
                      </p>
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
