# LCIT Meal API

Backend cho hệ thống quản lý suất ăn nội bộ: quản lý lịch bếp ăn, đăng ký / cắt
suất ăn, thanh toán theo tháng, thông báo và nhật ký hệ thống.

Stack: **Node.js + Express 5 + MySQL (mysql2) + JWT**, không dùng ORM — truy vấn
SQL viết tay trong tầng repository.

---

## 1. Yêu cầu môi trường

| Thành phần | Phiên bản khuyến nghị |
| --- | --- |
| Node.js | >= 20 |
| MySQL | >= 8.0 |
| npm | >= 10 |

---

## 2. Cài đặt & chạy

```bash
npm install
cp .env.example .env    # nếu chưa có, tạo file .env theo mẫu mục 3
npm run migrate        # sau khi import schema: thêm bảng lưu vết hủy bởi lịch nghỉ
npm run dev             # chạy dev (nodemon, tự restart khi sửa code)
npm start               # chạy production
```

Mặc định API chạy tại `http://localhost:3000`, toàn bộ endpoint nằm dưới tiền tố
`/api` (ví dụ `POST http://localhost:3000/api/auth/login`).

---

## 3. Biến môi trường (`.env`)

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qlsa

JWT_SECRET=chuoi_bi_mat_dai_va_ngau_nhien
```

Toàn bộ biến được đọc tập trung tại `src/config/env.js`. Không đọc
`process.env` rải rác trong code.

---

## 4. Cơ sở dữ liệu

Các bảng chính:

| Bảng | Vai trò |
| --- | --- |
| `user`, `role`, `user_role` | Tài khoản và phân quyền (1 user có thể nhiều role) |
| `meal` | Bếp ăn theo ngày — mỗi ngày tối đa 1 bản ghi (`UNIQUE meal_date`) |
| `meal_registration` | Đăng ký ăn của từng người theo ngày (`UNIQUE user_id + meal_id`) |
| `meal_option` | Yêu cầu cắt suất ăn (hôm nay / theo khoảng ngày / cắt hẳn) |
| `holiday_event` | Sự kiện hủy lịch bếp ăn (nghỉ lễ, Tết, sự kiện) |
| `payment` | Công nợ tiền ăn theo tháng của từng người |
| `notification`, `notification_recipient` | Thông báo và người nhận |
| `system_setting` | Cấu hình hệ thống dạng key–value |
| `audit_log` | Nhật ký thao tác toàn hệ thống |

Schema và dữ liệu seed có tại `sql/qlsa.sql`. Import vào database `qlsa` trước
khi chạy `npm run migrate`. Docker Compose ở thư mục gốc tự import file này
khi khởi tạo volume MySQL mới; volume đã có dữ liệu không được import lại.

`npm test` chạy integration test trên schema MySQL riêng, chỉ sao chép schema
và cấu hình từ database trong `.env`, rồi tự xóa schema test khi hoàn tất.
Tài khoản DB cần quyền tạo và xóa schema test. Test không sửa dữ liệu nghiệp vụ
trong database nguồn.

Dữ liệu demo: `node src/scripts/seedDumpDemo.js`.

---

## 5. Vai trò & phân quyền

Định nghĩa tại `src/constants/Role.js`, khớp với cột `role.code`:

| Role | Mô tả |
| --- | --- |
| `admin` | Quản trị hệ thống. **Không** tự đăng ký / cắt suất / thanh toán cho chính mình — chỉ thao tác hộ người khác |
| `manager` | Quản lý: xem toàn bộ dữ liệu, thao tác hộ nhân viên, vẫn là người ăn bình thường |
| `employee` | Cán bộ nhân viên: đăng ký / cắt suất ăn cho chính mình |
| `kitchen` | Bếp: chỉ xem trang chủ để biết số suất cần nấu, không truy cập API nghiệp vụ khác |

`ROLE.STAFF_ROLES` = `[admin, manager, employee]` — mọi vai trò trừ bếp.

Cơ chế: `authMiddleware` xác thực JWT (header `Authorization: Bearer <token>`),
`authorizeMiddleware` kiểm tra role trên từng route.

---

## 6. Nghiệp vụ chính

### 6.1 Đăng ký suất ăn

- Mỗi người tối đa **1 bản ghi đăng ký / 1 ngày** (ràng buộc UNIQUE).
- `POST /api/meal-registrations` xử lý cả 3 tình huống:
  1. Chưa có bản ghi → tạo mới.
  2. Bản ghi cũ đang `cancelled` → đăng ký lại (kích hoạt lại chính bản ghi đó).
  3. Bản ghi đang active nhưng đổi `guestCount` → cập nhật số khách.
  
  Chỉ báo lỗi 409 khi đăng ký lại y hệt (đang active và số khách không đổi).
- **Đăng ký thêm suất cho khách KHÔNG cần quản lý duyệt** — bản ghi được xác
  nhận (`confirmed`) ngay, quản lý chỉ nhận thông báo để chuẩn bị thêm suất.
- Giới hạn số khách: hằng số `MAX_GUEST_PER_REGISTRATION` trong
  `src/services/MealRegistrationService.js` (hiện là `10`).
- Không cho đăng ký ngày đã qua, hoặc ngày bếp đã hủy.

Trạng thái `meal_registration.status`:

| Trạng thái | Ý nghĩa |
| --- | --- |
| `confirmed` | Đã đăng ký, chưa tới giờ ăn |
| `completed` | Suất ăn đã thực sự diễn ra (do `mealCompletionJob` chuyển) |
| `cancelled` | Đã cắt suất |
| `pending` | **Không còn phát sinh mới.** Chỉ còn ở dữ liệu cũ tạo trước khi bỏ bước duyệt |

### 6.2 Cắt suất ăn

- **Cắt hôm nay tự động duyệt trước giờ chốt; Cắt theo khoảng ngày / tùy chỉnh và dài hạn cần Quản lý duyệt.**
- Phân loại duyệt theo `meal_option.type`:
  (`AUTO_APPROVE_TYPES` tại `src/constants/MealOption.js`):
  - `cancel_today` — cắt suất hôm nay (tự động duyệt trước giờ đóng)
  - `cancel_schedule` — cắt theo khoảng ngày / tùy chỉnh (chờ Quản lý duyệt)
  - `cancel_permanent` — cắt dài hạn (chờ Quản lý duyệt)
- Khi tạo, `syncMealRegistrations()` hủy luôn các đăng ký đã tồn tại trong khoảng
  ngày, để bếp / báo cáo không tính thừa suất.
- Quản lý nhận thông báo mang tính thông tin để điều chỉnh số suất cần nấu.
- API `approve` / `reject` và trạng thái `pending` vẫn được giữ để xử lý nốt các
  yêu cầu cũ tạo trước khi đổi nghiệp vụ.
- `PATCH /meal-options/:id/reactivate` (chỉ admin), body `{ "fromDate": "YYYY-MM-DD" }`:
  kết thúc yêu cầu cắt theo khoảng/dài hạn đã duyệt từ ngày chọn. Trước 08:20
  được chọn hôm nay; từ 08:20 chỉ được chọn ngày mai trở đi (giờ Việt Nam).
  Giữ lịch sử trước ngày khôi phục; nếu chưa bắt đầu cắt thì vô hiệu hóa yêu cầu.
  Trong một transaction, khôi phục suất cán bộ bị hủy và tạo suất còn thiếu
  trong lịch bếp hiện có, bỏ qua bếp đóng, ngày nghỉ và yêu cầu cắt khác còn hiệu lực.
  Suất đã đăng ký giữ nguyên; suất khôi phục có 0 khách. Tự động tạo suất các
  tháng sau tiếp tục áp dụng cấu hình hiện tại. Có audit log và thông báo cho cán bộ.

### 6.3 Hủy lịch bếp ăn (nghỉ lễ / sự kiện)

- Tạo `holiday_event` → đánh dấu `meal.is_cancelled` và hủy toàn bộ đăng ký
  trong khoảng ngày.
- **Mở lại** sự kiện → mở lại bếp ăn **và khôi phục** các đăng ký đã bị hủy về
  `confirmed`, đồng thời thông báo cho những người được khôi phục.

  > Lịch nghỉ mới lưu vết những bếp/đăng ký thực sự bị hủy bởi sự kiện trong
  > `holiday_event_meal` và `holiday_event_registration`. Mở lại dùng transaction,
  > giữ nguyên suất tự cắt và chờ đến khi hết mọi sự kiện chồng nhau mới khôi phục.
  > Lịch nghỉ cũ trước migration không có dữ liệu nguồn để phân biệt lý do hủy;
  > hệ thống không tự khôi phục các bản ghi thiếu dấu vết. Quản lý cần kiểm tra và
  > mở lại bếp/đăng ký các ngày cũ bằng thao tác riêng khi cần.

### 6.4 Trạng thái thời gian thực của bếp ăn

`GET /api/meals/filter` và `getByDate()` trả thêm trường `completionStatus`,
**tính lại mỗi lần truy vấn** (không lưu DB), dựa trên `meal_date` và cấu hình
`system_setting.meal_completion_time` (mặc định `12:00`):

| Giá trị | Điều kiện |
| --- | --- |
| `completed` | Ngày đã qua, hoặc là hôm nay và đã qua giờ hoàn thành |
| `serving` | Là hôm nay và chưa tới giờ hoàn thành |
| `pending` | Ngày trong tương lai |

---

## 7. Cronjob

Cả 3 job khởi động cùng server (`src/server.js`), múi giờ `Asia/Ho_Chi_Minh`.

| Job | Lịch chạy | Nhiệm vụ |
| --- | --- | --- |
| `autoScheduleJob` | 20:00 hàng ngày | Tạo bếp ăn cho ngày mai + tự động đăng ký cho người đang bật `auto_register_enabled` (bỏ qua người có yêu cầu cắt suất còn hiệu lực) |
| `mealCompletionJob` | Kiểm tra mỗi 5 phút | Khi qua giờ `meal_completion_time`, chuyển đăng ký `confirmed` → `completed` |
| `paymentReminderJob` | 09:00 hàng ngày | Nhắc thanh toán khi tới ngày `payment_due_day` |

Chạy tay để test (chỉ `admin`):

```
POST /api/admin-tools/run-auto-schedule?date=2026-09-08
POST /api/admin-tools/run-meal-completion?date=2026-09-08
```

---

## 8. Cấu hình hệ thống (`system_setting`)

Key được khai báo tập trung tại `src/constants/SystemSetting.js`:

| Key | Ý nghĩa |
| --- | --- |
| `registration_close_time` | Giờ khóa đăng ký trong ngày |
| `meal_price` / `guest_meal_price` | Đơn giá suất ăn nhân viên / khách |
| `auto_register_enabled` | Bật tự động đăng ký hàng ngày |
| `auto_register_start_day` | Ngày bắt đầu áp dụng tự động đăng ký |
| `max_guest_per_registration` | Số khách tối đa mỗi lần đăng ký |
| `payment_due_day` | Ngày đến hạn thanh toán trong tháng |
| `payment_reminder_enabled` | Bật nhắc thanh toán |
| `payment_qr_image` | Ảnh QR thanh toán |
| `meal_completion_time` | Giờ chuyển suất ăn sang "đã hoàn thành" |

---

## 9. Cấu trúc thư mục

```
src/
├── app.js                 # Khởi tạo Express, CORS, static /uploads, error handler
├── server.js              # Lắng nghe cổng + start cronjob
├── config/                # env.js, database.js (connection pool)
├── constants/             # Hằng số khớp giá trị enum trong DB
├── controllers/           # Nhận request, gọi service, trả ApiResponse
├── services/              # Nghiệp vụ, validate, audit log, thông báo
├── repos/                 # Truy vấn SQL thuần tới MySQL
├── models/                # Map row DB (snake_case) → object (camelCase)
├── modules/               # Wiring: repo → service → controller → router
├── routes/                # Định nghĩa endpoint + phân quyền
├── middlewares/           # auth, authorize, error
├── jobs/                  # Cronjob
├── scripts/               # Script seed dữ liệu demo
└── ultis/                 # AppError, ApiResponse
```

Luồng xử lý: `routes → controller → service → repository → MySQL`. Service là nơi
duy nhất chứa nghiệp vụ; controller không truy vấn DB trực tiếp.

---

## 10. Nhóm endpoint chính

| Prefix | Chức năng |
| --- | --- |
| `/api/auth` | `POST /login`, `POST /logout` |
| `/api/users`, `/api/roles` | Quản lý người dùng, vai trò |
| `/api/meals` | Lịch bếp ăn theo ngày |
| `/api/meal-registrations` | Đăng ký / cắt suất, xuất Excel |
| `/api/meal-options` | Yêu cầu cắt suất ăn |
| `/api/holiday-events` | Hủy lịch nghỉ lễ / sự kiện |
| `/api/payments` | Công nợ tiền ăn, xuất Excel |
| `/api/notifications` | Thông báo |
| `/api/system-settings` | Cấu hình hệ thống |
| `/api/dashboard` | Số liệu trang chủ |
| `/api/audit-logs` | Nhật ký hệ thống |
| `/api/admin-tools` | Chạy tay cronjob (admin) |

Response chuẩn hóa qua `src/ultis/ApiResponse.js`; lỗi nghiệp vụ ném
`AppError(message, statusCode)` và được `errorMiddleware` bắt tập trung.

---

## 11. Ghi chú khi triển khai

- **CORS:** cấu hình `CORS_ORIGINS` là các origin phân cách bởi dấu phẩy.
  Mặc định cho localhost/127.0.0.1 cổng 5173 và 8081. Khi deploy, đặt danh sách
  domain thật. Không bật wildcard cho origin lạ.
- **Dữ liệu cũ:** các bản ghi `meal_option` và `meal_registration` còn ở trạng
  thái `pending` từ trước khi bỏ bước duyệt vẫn nằm trong DB. Quản lý nên xử lý
  nốt ở trang "Theo dõi cắt suất ăn", hoặc chạy một câu `UPDATE` để duyệt hàng loạt.
- **Giới hạn số khách** hiện hard-code trong `MealRegistrationService.js`, trong
  khi DB đã có sẵn key `max_guest_per_registration` chưa được dùng tới. Nếu muốn
  chỉnh giới hạn từ giao diện Quản lý cấu hình thì cần nối service đọc từ
  `system_setting` thay vì đọc hằng số.
- File upload (ảnh QR) lưu tại `public/uploads`, phục vụ qua `/uploads`. Cần
  đảm bảo thư mục này tồn tại và được ghi khi deploy.
