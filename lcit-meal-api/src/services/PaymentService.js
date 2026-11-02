const PAYMENT_STATUS = require("../constants/Payment");
const LOG_ACTION = require("../constants/LogAction");
const AppError = require("../ultis/AppError");
const { buildMealLedger } = require('../ultis/mealLedger');

class PaymentService {
  constructor(paymentRepository, notificationService, auditLogService) {
    this.paymentRepository = paymentRepository;
    this.notificationService = notificationService;
    this.auditLogService = auditLogService;
  }

  async list() {
    await this.syncMonthlyPayments();
    return this.paymentRepository.list();
  }

  async monthlyBoard(month) {
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000) throw new AppError('Tháng không hợp lệ', 400);
    const [year, number] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
    const MealRepository = require('../repos/MealRepository');
    const RegistrationRepository = require('../repos/MealRegistrationRepository');
    const UserRepository = require('../repos/UserRepository');
    const mealRepository = new MealRepository();
    const [users, registrations, meals, guests, payments, settings] = await Promise.all([
      new UserRepository().list(), new RegistrationRepository().filter(null, null, null, from, to),
      mealRepository.filter(from, to), mealRepository.filterGuestCounts(from, to),
      this.filter(null, null, from, to), this.paymentRepository.collectionPrices(),
    ]);
    return { users: users.map(u => ({ id: u.id, fullName: u.fullName, username: u.username })),
      registrations: registrations.map(r => ({ userId: r.userId, mealDate: r.mealDate, guestCount: r.guestCount, status: r.status })),
      meals, guests, payments, settings };
  }

  async get(id) {
    const payment = await this.paymentRepository.get(id);

    if (!payment) {
      throw new AppError("Khoản thanh toán không tồn tại", 404);
    }

    return payment;
  }

  async listByUser(userId) {
    await this.syncMonthlyPayments(userId);
    return this.paymentRepository.listByUser(userId);
  }

  async getMealLedger(userId) {
    await this.syncMonthlyPayments(userId);
    const [days, payments] = await Promise.all([
      this.paymentRepository.getMealLedgerDays(userId),
      this.paymentRepository.listByUser(userId),
    ]);
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
    return buildMealLedger(days, payments, currentMonth);
  }

  async filter(userId, status, fromDate, toDate) {
    await this.syncMonthlyPayments(userId);
    return this.paymentRepository.filter(userId, status, fromDate, toDate);
  }

  async syncMonthlyPayments(userId, now = new Date()) {
    const { date, time } = require('../ultis/monthlyBilling').vietnamClock(now);
    return this.paymentRepository.generateMonthlyPayments(date, time, userId);
  }

  // Tạo hóa đơn thanh toán cho 1 nhân viên (thường do quản lý/admin lập cuối kỳ)
  async create(data, actor = {}) {
    this.validateCreateData(data);

    const payment = await this.paymentRepository.create({
      userId: data.userId,
      paymentDate: data.paymentDate,
      amount: data.amount,
      status: data.status || PAYMENT_STATUS.UNPAID,
    });

    await this.logAction(
      LOG_ACTION.ACTION_CREATE,
      actor,
      `payment:${payment.id}`,
      "Tạo khoản thanh toán",
      null,
      payment,
    );

    await this.notificationService.notifyUser(
      {
        title: "Hóa đơn thanh toán mới",
        content: `Bạn có một khoản thanh toán ${Number(data.amount).toLocaleString("vi-VN")}đ cho kỳ ${data.paymentDate}.`,
        url: `/payment/view?id=${payment.id}`,
        createdBy: actor.actorId || null,
      },
      data.userId,
    );

    return payment;
  }

  validateCreateData(data) {
    if (!data.userId) {
      throw new AppError("userId là bắt buộc", 400);
    }

    if (!data.paymentDate) {
      throw new AppError("paymentDate là bắt buộc", 400);
    }

    this.validateAmount(data.amount, 'amount');
  }

  validateAmount(value, field) {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new AppError(`${field} phải là số không âm hợp lệ`, 400);
    }
  }

  async update(id, data, actor = {}) {
    const payment = await this.get(id);
    if (data.amount !== undefined) this.validateAmount(data.amount, 'amount');

    const updated = await this.paymentRepository.update(id, {
      paymentDate: data.paymentDate || payment.paymentDate,
      amount: data.amount !== undefined ? data.amount : payment.amount,
      status: data.status || payment.status,
    });

    await this.logAction(
      LOG_ACTION.ACTION_UPDATE,
      actor,
      `payment:${id}`,
      "Cập nhật khoản thanh toán",
      payment,
      updated,
    );

    return updated;
  }

  // Xác nhận nhân viên đã thanh toán (kèm ảnh hóa đơn/số tiền thực trả)
  async markPaid(id, data, actor = {}) {
    const payment = await this.get(id);

    if (payment.isPaid) {
      throw new AppError("Khoản thanh toán này đã được xác nhận trước đó", 409);
    }

    const paidAmount =
      data.paidAmount !== undefined ? data.paidAmount : payment.amount;
    this.validateAmount(paidAmount, 'paidAmount');

    const marked = await this.paymentRepository.markPaid(id, {
      paidAmount,
      billImg: data.billImg,
      status: PAYMENT_STATUS.PAID,
    });

    await this.logAction(
      LOG_ACTION.ACTION_MARK_PAID,
      actor,
      `payment:${id}`,
      "Xác nhận đã thanh toán",
      payment,
      marked,
    );

    return marked;
  }

  async delete(id, actor = {}) {
    const payment = await this.get(id);

    await this.paymentRepository.delete(id);

    await this.logAction(
      LOG_ACTION.ACTION_DELETE,
      actor,
      `payment:${id}`,
      "Xóa khoản thanh toán",
      payment,
      null,
    );

    return true;
  }

  async logAction(action, actor, target, detail, oldData, newData) {
    try {
      await this.auditLogService.create({
        logActor: actor.actorId || null,
        logAction: action,
        logTarget: target,
        logResult: "success",
        logDetail: detail,
        ipAddress: actor.ipAddress || null,
        userAgent: actor.userAgent || null,
        status: "success",
        oldData,
        newData,
      });
    } catch (error) {
      console.error("Ghi audit log thất bại:", error.message);
    }
  }
}

module.exports = PaymentService;
