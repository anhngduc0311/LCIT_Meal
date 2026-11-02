const ApiResponse = require("../ultis/ApiResponse");
const paginate = require("../ultis/paginate");
const { sendExcel } = require("../ultis/excelExport");
const { getActor } = require("../ultis/actor");

class PaymentController {
  monthlyBoard = async (req, res, next) => {
    try { return ApiResponse.success(res, await this.paymentService.monthlyBoard(req.query.month)); }
    catch (error) { next(error); }
  };
  constructor(paymentService) {
    this.paymentService = paymentService;
  }

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
