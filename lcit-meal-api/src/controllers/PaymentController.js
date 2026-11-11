const ApiResponse = require("../ultis/ApiResponse");
const paginate = require("../ultis/paginate");
const { sendExcel } = require("../ultis/excelExport");
const { getActor } = require("../ultis/actor");
const AppError = require("../ultis/AppError");

const monthlyColumns = [
  { header: "Cán bộ", key: "name", width: 33 },
  { header: "Tài khoản", key: "username", width: 20 },
  { header: "Suất cán bộ", key: "staff", width: 14 },
  { header: "Tiền cán bộ (đ)", key: "staffAmount", width: 20 },
  { header: "Suất khách", key: "guests", width: 14 },
  { header: "Tiền khách (đ)", key: "guestAmount", width: 20 },
  { header: "Chênh lệch (đ)", key: "adjustmentAmount", width: 20 },
  { header: "Đã thu (đ)", key: "paidAmount", width: 18 },
  { header: "Còn cần thu (đ)", key: "remainingAmount", width: 20 },
  { header: "Đóng dư (đ)", key: "creditAmount", width: 18 },
];
const monthlyNumberKeys = monthlyColumns.slice(2).map(column => column.key);

class PaymentController {
  monthlyBoard = async (req, res, next) => {
    try { return ApiResponse.success(res, await this.paymentService.monthlyBoard(req.query.month)); }
    catch (error) { next(error); }
  };
  constructor(paymentService) {
    this.paymentService = paymentService;
  }

  exportMonthlyBoard = async (req, res, next) => {
    try {
      const { month, throughDate, rows, guestCount, guestAmount } = req.body || {};
      if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        typeof throughDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate) ||
        !Array.isArray(rows) || rows.length > 10000 ||
        !Number.isSafeInteger(guestCount) || guestCount < 0 || !Number.isFinite(guestAmount) || guestAmount < 0) {
        throw new AppError("Dữ liệu xuất báo cáo tháng không hợp lệ", 400);
      }

      const totals = Object.fromEntries(monthlyNumberKeys.map(key => [key, 0]));
      const staffRows = rows.map(row => {
        if (!row || typeof row.name !== "string" || typeof row.username !== "string" ||
          monthlyNumberKeys.some(key => !Number.isFinite(row[key]))) {
          throw new AppError("Dữ liệu cán bộ không hợp lệ", 400);
        }
        const cells = { name: row.name, username: row.username };
        for (const key of monthlyNumberKeys) {
          cells[key] = row[key];
          totals[key] += row[key];
        }
        return cells;
      });

      res.setHeader("Cache-Control", "no-store");
      await sendExcel(res, "thu-tien-an_co-so-1_" + month, "Cơ sở 1", monthlyColumns, [
        ...staffRows,
        { name: "Tổng cộng theo cán bộ", ...totals },
        {},
        { name: "Khách thêm riêng tại Cơ sở 1", guests: guestCount, guestAmount },
        { name: "Tháng báo cáo", username: month },
        { name: "Tính đến ngày", username: throughDate },
      ]);
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const payments = await this.paymentService.list();

      return ApiResponse.success(res, paginate(payments, req.query));
    } catch (error) {
      next(error);
    }
  };

  // Lịch sử thanh toán của chính người dùng đang đăng nhập
  mealLedgerMine = async (req, res, next) => {
    try {
      return ApiResponse.success(res, await this.paymentService.getMealLedger(req.user.id));
    } catch (error) { next(error); }
  };

  listMine = async (req, res, next) => {
    try {
      const payments = await this.paymentService.listByUser(req.user.id);

      return ApiResponse.success(res, paginate(payments, req.query));
    } catch (error) {
      next(error);
    }
  };

  get = async (req, res, next) => {
    try {
      const payment = await this.paymentService.get(req.params.id);

      return ApiResponse.success(res, payment);
    } catch (error) {
      next(error);
    }
  };

  filter = async (req, res, next) => {
    try {
      const { userId, status, from, to } = req.query;

      const payments = await this.paymentService.filter(
        userId,
        status,
        from,
        to,
      );

      return ApiResponse.success(res, paginate(payments, req.query));
    } catch (error) {
      next(error);
    }
  };

  // GET /api/payments/export?userId&status&from&to - xuất Excel
  export = async (req, res, next) => {
    try {
      const { userId, status, from, to } = req.query;

      const payments = await this.paymentService.filter(
        userId,
        status,
        from,
        to,
      );

      const STATUS_LABEL = {
        paid: "Đã thanh toán",
        unpaid: "Chưa thanh toán",
        overdue: "Quá hạn",
      };

      await sendExcel(
        res,
        `thanh-toan_${from || "all"}_${to || "all"}`,
        "Thanh toán",
        [
          { header: "Mã", key: "id", width: 8 },
          { header: "Cán bộ", key: "userName", width: 28 },
          { header: "Kỳ thanh toán", key: "paymentDate", width: 16 },
          { header: "Số tiền", key: "amount", width: 16 },
          { header: "Đã trả", key: "paidAmount", width: 16 },
          { header: "Trạng thái", key: "statusLabel", width: 18 },
        ],
        payments.map((p) => ({
          id: p.id,
          userName: p.userName,
          paymentDate: p.paymentDate,
          amount: Number(p.amount),
          paidAmount: p.paidAmount !== null ? Number(p.paidAmount) : "",
          statusLabel: STATUS_LABEL[p.status] || p.status,
        })),
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const payment = await this.paymentService.create(
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, payment, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const payment = await this.paymentService.update(
        req.params.id,
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, payment);
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req, res, next) => {
    try {
      const payment = await this.paymentService.markPaid(
        req.params.id,
        req.body,
        getActor(req),
      );

      return ApiResponse.success(res, payment);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.paymentService.delete(req.params.id, getActor(req));

      return ApiResponse.success(res, null);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = PaymentController;
