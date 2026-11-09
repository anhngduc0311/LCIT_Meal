# SPEC — LCIT Meal API hiện tại

> Phiên bản: 2.0 · Cập nhật: 25/09/2026.
>
> Nguồn: src/, package.json, sql/qlsa.sql; kiến trúc tại [architecture.md](architecture.md).
>
> Thay SPEC 1.0 đề xuất .NET/PostgreSQL bằng đặc tả backend đang có. Chưa phải biên bản nghiệm thu runtime.

## 1. IDEA và phạm vi

Backend quản lý suất ăn theo ngày: tài khoản, lịch ăn, đăng ký/khách, cắt suất, lịch nghỉ, báo cáo, khoản thanh toán thủ công, thông báo, cấu hình và audit.

Phạm vi tài liệu là API Node.js/Express và database MySQL/MariaDB. Không xác nhận stack, màn hình hay build web/mobile. Chưa có ngân hàng tự động, FCM, enrollment, sổ phí, outbox hoặc worker riêng trong baseline.

Quy ước:

- **Hiện có:** đọc thấy triển khai; phải kiểm thử trước khi đánh dấu đạt.
- **Giới hạn/GAP:** thiếu sót hoặc lỗi trong code; không phải hành vi sản phẩm cần duy trì.
- **Mở rộng:** chức năng mới cần chọn phạm vi riêng, không tự suy thành việc phải triển khai.

FR giữ chủ đề bản 1.0 để đối chiếu nhưng nội dung được thay bằng hiện trạng. Không chuyển kết quả nghiệm thu cũ sang bản này. Gate/task .NET, Flutter, Angular cũ không còn là kế hoạch bắt buộc của repository.

## 2. Requirements — hành vi hiện có

| ID | Phạm vi | Hành vi và giới hạn |
|---|---|---|
| FR-01 | Authentication | Login username/password, bcrypt, JWT 7d, token hiện tại trên user; logout xóa token; middleware đọc DB mỗi request. Không Session, refresh hoặc GET auth/me |
| FR-02 | Authorization | Role middleware, một số mutation có ownership. Dashboard và một số get/create chưa đủ scope: GAP-01 |
| FR-03 | User | CRUD/filter/availability, sửa hồ sơ/mật khẩu mình, batch JSON, soft/hard delete, chọn role. Chưa bảo vệ admin cuối/lịch sử cascade |
| FR-04 | Người ăn | Không enrollment; job xét user active, không xét tư cách ăn/khoảng hiệu lực |
| FR-05 | Lịch | Đọc/lọc/tạo/sửa/xóa meal, hủy/mở lại; unique meal_date. Kitchen không được route lịch cho phép |
| FR-06 | Sinh suất | Theo tháng, thứ trong tuần, holiday; bỏ user không active, cắt approved bao phủ và hàng đã có. Không eligibility service chung |
| FR-07 | Đăng ký lại | POST mealId tạo/cập nhật hàng cũ thành confirmed; cùng số khách trên hàng chưa cancelled trả 409. Chặn Admin tự đăng ký; thiếu kiểm thời gian/ownership đầy đủ |
| FR-08 | Cắt hôm nay | cancel_today tự approved, ngày do client gửi, kiểm giờ đóng khi fromDate đúng hôm nay. Đồng bộ suất không cùng transaction |
| FR-09 | Cắt khoảng/hẳn | cancel_schedule/cancel_permanent cũng tự approved; đều cần fromDate/toDate. Chưa có khoảng vô hạn/kiểm chồng |
| FR-10 | Phê duyệt | API meal-option pending cũ; approve-cancel/reject-cancel cho registration pending. Chưa version/quyết định nguyên tử |
| FR-11 | Thao tác hộ | Actor metadata và target userId; chưa source ON_BEHALF/override riêng, reason bắt buộc hoặc kiểm ownership đầy đủ ở create |
| FR-12 | Khách | guestCount trên registration, confirmed ngay, báo quản lý. Kiểm giới hạn 0–10, chưa kiểm số nguyên đầy đủ; không workflow duyệt khách |
| FR-13 | Hủy/mở bếp | Meal riêng đổi cờ/báo người nhận; holiday đồng bộ suất theo khoảng. Restore có thể phục hồi suất tự cắt |
| FR-14 | Hoàn thành | Job confirmed → completed theo ngày, không sinh phí; chưa bảo vệ completed ở mọi luồng, chưa loại bếp hủy trong query completion |
| FR-15 | Dashboard | Hôm nay, chart week/month/year, paymentList, outstanding, badge; chart đếm completed. Trả dữ liệu tổng hợp cho mọi user đăng nhập |
| FR-16 | Báo cáo | List/filter/phân trang, Excel đăng ký/payment. Không báo cáo ledger/kỳ khóa |
| FR-17 | Thanh toán | Nhập amount/paymentDate/status, mark-paid lưu is_paid/paid_amount/paid_at/bill_img. Không tự tính hóa đơn từ suất |
| FR-18 | Điều chỉnh tiền | Update/delete theo quyền; chưa giao dịch đảo, thu nhiều lần hoặc idempotency thu tiền |
| FR-19 | Cấu hình | Key/value, bulk tuần tự, lịch thứ, QR. Bulk chưa nguyên tử, không giá theo hiệu lực |
| FR-20 | Thông báo | CRUD/send, inbox recipient, unseen/seen/seen-all, broadcast user active. Route đọc chung chưa giới hạn recipient |
| FR-21 | Push/outbox | Chưa triển khai; ghi notification trực tiếp trong luồng nghiệp vụ |
| FR-22 | Batch user | JSON users; validate dòng/trùng/role/status rồi tạo user–role trong transaction. Không API upload Excel/preview/commit riêng |
| FR-23 | Audit | Admin đọc/list/filter; service ghi actor/action/target/result/old/new. Lỗi audit thường chỉ console; không cùng transaction nghiệp vụ |
| FR-24 | Role | Constants cố định, role/user_role trong DB, API role chỉ đọc; không permission catalog/quyền động |

### 2.1. Phân biệt hai luồng cắt

| Tình huống | Hiện trạng |
|---|---|
| Tạo meal-option hôm nay (`cancel_today`) | Approved theo AUTO_APPROVE_TYPES = [CANCEL_TODAY] (nếu trước giờ đóng) |
| Tạo meal-option tùy chỉnh / khoảng ngày / dài hạn (`cancel_schedule`, `cancel_permanent`) | Pending chờ Quản lý duyệt; sau khi duyệt mới tự động hủy registration trong khoảng |
| Meal-option fromDate hôm nay, quá giờ đóng | Bị từ chối nếu có cấu hình giờ đóng |
| Employee cắt trực tiếp sau đóng, trước hoàn thành | Registration pending chờ quản lý |
| Manager/Admin cắt trực tiếp khoảng giờ trên | Cancelled nếu qua các kiểm tra khác |
| Approve-cancel / reject-cancel | Pending → cancelled / confirmed |
| Đăng ký có khách | Confirmed ngay, báo quản lý |
| Đăng ký lại registration cancelled | POST cập nhật hàng đó, không xóa meal-option |
| Reactivate meal-option | Route/controller có, service method thiếu; chưa hoàn chỉnh |

Quy tắc: Cắt hôm nay tự động duyệt trước giờ chốt; Cắt theo khoảng ngày / tùy chỉnh / dài hạn bắt buộc Quản lý duyệt. Pending trên registration vẫn tồn tại do cắt trực tiếp sau giờ chốt.

### 2.2. Phi chức năng

| Chủ đề | Hiện có | Chưa chứng minh/chưa có |
|---|---|---|
| Transaction | User batch, đổi role, hard delete có transaction cục bộ | Nguyên tử suất/audit/notification, race approval |
| Bảo mật | Bcrypt, JWT+DB check, role, CORS một origin | Login rate limit, ownership đầy đủ, admin cuối |
| Đồng thời | Unique meal_date và user–meal | Idempotency-Key, version, distributed lease |
| Thời gian | Cron/đa số helper dùng giờ Việt Nam | Clock thống nhất với UTC/SQL |
| Tiền | DECIMAL trong SQL | Giá snapshot, ledger, đối soát tự động |
| Hiệu năng | Pool 10, một số SQL pagination | Load test/P95; nhiều list đọc toàn bộ rồi cắt |
| Phục hồi | Catch-up cùng ngày ở một số job | Quét ngày bỏ lỡ, retry/outbox bền vững |
| Quan sát | Console, audit, root response | Health DB, metrics, traceId, cảnh báo |
| Triển khai | npm dev/start, env, SQL dump | CI/CD, container/HTTPS/runbook, restore thực đo |

Không gán P95, RPO/RTO hoặc SLA đã đạt khi chưa có phép đo. Package chưa khai báo script test/lint/build.

## 3. Design và API

### 3.1. Cấu trúc

Routes → authentication/authorization → controller → service → repository → database. Modules ghép dependency; models mapping; jobs cùng process HTTP. Dữ liệu và quyền ở [architecture.md](architecture.md).

### 3.2. Response và pagination

Base /api, JSON, object thường camelCase, ID số nguyên. Route bảo vệ nhận Authorization: Bearer token.

```json
{"success":true,"payload":null,"error":null}
```

```json
{"success":false,"payload":null,"error":{"code":409,"message":"Thông báo lỗi"}}
```

Create thường 201, thành công khác thường 200. AppError dùng 400/401/403/404/409 tùy nhánh; lỗi không có statusCode thành 500. Chưa có Problem Details, traceId, ETag/If-Match hoặc Idempotency-Key contract.

Endpoint dùng paginate() trả mảng nếu không có tham số; có page/limit hoặc alias pageSize thì payload là data và pagination (page, limit, total, totalPages, hasNextPage, hasPreviousPage). Helper mặc định 20, tối đa 200. Không áp dụng quy tắc này cho mọi route: /me có thể trả mảng, filter SQL dùng helper khác. Export trả file.

### 3.3. Endpoint hiện có

Các đường dẫn có prefix /api. A = Admin, M = Manager, S = Admin/Manager/Employee, U = user xác thực. Đây là quyền route, xem GAP-01 về scope.

| Nhóm | Method và path | Quyền |
|---|---|---|
| Auth | POST /auth/login; POST /auth/logout | Public; U |
| Users | GET /users, /users/filter, /users/:id | A/M |
| Users | GET /users/availability; POST /users, /users/batch; PUT /users/:id; DELETE /users/:id, /users/:id/force | A |
| Profile | PATCH /users/me | U |
| Roles | GET /roles, /roles/code/:code, /roles/:id | A/M |
| Meals | GET /meals, /meals/filter, /meals/:id | S |
| Meals | GET /meals/:id/summary; POST /meals; PUT /meals/:id; PATCH /meals/:id/cancel, /meals/:id/restore | A/M |
| Meals | DELETE /meals/:id | A |
| Registrations | GET /meal-registrations, /meal-registrations/filter, /meal-registrations/meal/:mealId, /meal-registrations/meal/:mealId/summary, /meal-registrations/export | A/M |
| Registrations | GET /meal-registrations/me, /meal-registrations/:id; POST /meal-registrations; PUT /meal-registrations/:id; PATCH /meal-registrations/:id/cancel | S |
| Registrations | PATCH /meal-registrations/:id/confirm, /meal-registrations/:id/approve-cancel, /meal-registrations/:id/reject-cancel; DELETE /meal-registrations/:id | A/M |
| Options | GET /meal-options, /meal-options/filter; PATCH /meal-options/:id/approve, /meal-options/:id/reject, /meal-options/:id/reactivate | A/M; reactivate thiếu service |
| Options | GET /meal-options/me, /meal-options/:id; POST /meal-options; PUT /meal-options/:id; DELETE /meal-options/:id | S |
| Holidays | GET /holiday-events, /holiday-events/:id | S |
| Holidays | POST /holiday-events; PATCH /holiday-events/:id/restore | A/M |
| Payments | GET /payments, /payments/filter, /payments/export, /payments/:id; POST /payments; PUT /payments/:id; PATCH /payments/:id/mark-paid | A/M |
| Payments | GET /payments/me; DELETE /payments/:id | S; A |
| Notifications | GET /notifications, /notifications/filter, /notifications/me, /notifications/me/unseen-count, /notifications/:id; PATCH /notifications/me/seen-all, /notifications/:id/seen | S |
| Notifications | POST /notifications, /notifications/send; PUT /notifications/:id; DELETE /notifications/:id | A/M |
| Settings | GET /system-settings, /system-settings/key/:key, /system-settings/:id, /system-settings/meal-schedule-config | S |
| Settings | POST /system-settings, /system-settings/payment-qr; PUT /system-settings/key/:key, /system-settings/bulk, /system-settings/meal-schedule-config | A |
| Dashboard | GET /dashboard/home, /dashboard/chart | U |
| Audit | GET /audit-logs, /audit-logs/filter, /audit-logs/:id | A |
| Jobs | POST /admin-tools/run-auto-schedule?month=YYYY-MM | A/M |
| Jobs | POST /admin-tools/run-meal-completion?date=YYYY-MM-DD | A |

Nguồn: [src/routes/api.js](src/routes/api.js), các file *Routes.js. API chạy job là mutation, không phải xem trước.

### 3.4. Đầu vào chính

| Thao tác | Trường service xử lý |
|---|---|
| Login | username, password |
| Tạo user | fullName, username, password; roleId/status tùy chọn. Mặc định status là `1`. API chuẩn hóa `active` và `acitve` thành `1`, `inactive` thành `0`, `locked` thành `2`. Giá trị ngoài các mã `1`, `0`, `2`, `-1` và các tên tương ứng bị từ chối với HTTP 400. |
| Batch user | { users: [...] }; dòng có fullName, username, password, roleId hoặc role/roleCode, status |
| Tạo meal | mealDate, note, status |
| Đăng ký | mealId, guestCount; userId tùy chọn, bỏ thì dùng actor |
| Tạo cắt | type, fromDate, toDate, note; userId tùy chọn |
| Holiday | name, fromDate, toDate, reason |
| Payment | userId, paymentDate, amount, status |
| Mark-paid | paidAmount, billImg; bỏ paidAmount dùng amount |
| QR | Multipart file, PNG/JPEG/WebP, tối đa 5 MB |
| Chart | period=week/month/year, date; period khác fallback week |

Đây không phải bảo đảm validation đầy đủ. Quyền userId, định dạng ngày, số khách/tiền còn GAP. Không đưa version, enrollmentId, periodId, idempotencyKey của thiết kế cũ vào request hiện tại.

## 4. Kiểm chứng và việc còn lại

### 4.1. Kịch bản xác nhận baseline

Các ca sau là kế hoạch trên database thử, **chưa chạy/đánh dấu đạt** trong lần sửa tài liệu. Không dùng để bảo tồn các lỗi ở §4.2.

| ID | Kịch bản | Kết quả đối chiếu |
|---|---|---|
| AC-01 | Login, gọi route bảo vệ, logout, gọi lại | Có accessToken; sau logout bị từ chối |
| AC-02 | Employee POST users; Admin tạo user | Employee 403. Tài khoản do Admin tạo với status bỏ trống, `active` hoặc `acitve` được lưu với status `1`. |
| AC-03 | Batch hợp lệ và dòng trùng/sai role | Hợp lệ tạo user/role; lỗi bị từ chối; kiểm rollback với DB thật |
| AC-04 | Tạo meal trùng ngày | Không có hai hàng cùng ngày |
| AC-05 | Auto-schedule hai lần tuần tự cùng tháng | Không thêm hàng đã có; giữ status cũ |
| AC-06 | Cắt approved bao phủ ngày trước khi sinh suất | Không tạo suất mới user/ngày đó |
| AC-07 | Tạo ba loại meal-option hợp lệ trước giờ đóng | Đều approved; đồng bộ hủy khoảng |
| AC-08 | Đăng ký guestCount hợp lệ | Confirmed ngay, lưu khách, báo quản lý |
| AC-09 | Đăng ký lại cancelled; gửi lại cùng khách | Dùng lại hàng cũ; lần lặp sau trả 409 |
| AC-10 | Employee cắt sau giờ đóng, trước hoàn thành | Pending; approve-cancel → cancelled hoặc reject-cancel → confirmed |
| AC-11 | Completion hai lần ngày thử | Confirmed → completed; lần sau không đổi lại hàng đó |
| AC-12 | Chart tuần/tháng/năm trên fixture | Đếm completed, kiểm ngày trống |
| AC-13 | Payment rồi mark-paid | Lưu amount/ngày; cập nhật is_paid/paid_amount/paid_at |
| AC-14 | Gửi notification, inbox, seen-all | Inbox/seen-all tác động recipient của mình |
| AC-15 | Admin upload QR hợp lệ | Tạo file, cập nhật setting/URL uploads |
| AC-16 | Không phải Admin gọi audit | 403 |

### 4.2. Giới hạn và lỗi qua đọc code

Backlog đề xuất sửa lỗi; lần cập nhật tài liệu không sửa API. Ưu tiên là đánh giá kỹ thuật, chưa cam kết lịch phát hành.

| ID | Ưu tiên | Phát hiện và nguồn | Điều kiện đóng |
|---|---|---|---|
| GAP-01 | Cao | Dashboard trả thanh toán toàn cơ quan; get/create theo ID chưa đủ ownership (DashboardRepository, MealOptionController/Service, MealRegistrationService, NotificationService) | API test theo role/user khác chứng minh scope đúng chính sách |
| GAP-02 | Cao | Hủy khoảng chọn cả completed; completion không loại meal hủy (MealRegistrationRepository) | Các luồng bảo vệ dữ liệu hoàn thành/bếp nghỉ; có regression |
| GAP-03 | Cao | Hủy meal riêng không đồng bộ suất/transaction (MealService) | Hủy/mở nhất quán, rollback khi bước liên quan lỗi |
| GAP-04 | Cao | Holiday restore mọi cancelled trong khoảng (HolidayEventService) | Giữ cắt cá nhân, xử lý sự kiện chồng nhau đúng chính sách |
| GAP-05 | Cao | Nghiệp vụ/audit/notification ghi tách; approve read-then-write; không idempotency | Fault/race test không ghi một phần/quyết định hai lần |
| GAP-06 | Cao | Force delete cascade, thiếu admin cuối (UserService/Repository, SQL) | Chặn mất lịch sử và mất quản trị viên cuối theo chính sách |
| GAP-07 | Vừa | Reactivate route/controller thiếu method service | Hoàn thiện hoặc gỡ contract; integration test |
| GAP-08 | Cao | UTC/local/giờ đóng không thống nhất; TODAY không ép ngày; permanent hữu hạn | Chốt hành vi, kiểm biên ngày/giờ, đồng bộ luồng |
| GAP-09 | Cao | Payment mutable/boolean, thiếu snapshot/ledger; validation tiền/khách chưa đủ | Validation dữ liệu sai và quy tắc đối soát được xác nhận/kiểm thử |
| GAP-10 | Vừa | lastRunDate trước thành công; không quét ngày bỏ lỡ; nhiều instance chạy cron | Test lỗi/restart/nhiều instance bảo đảm phục hồi |
| GAP-11 | Vừa | Bulk settings tuần tự; QR chỉ kiểm MIME, có thể dư file khi update setting lỗi | Kiểm validation và rollback/cleanup |
| GAP-12 | Vừa | Chưa test suite/CI/health DB/metrics/runbook/restore | Có kiểm thử và bằng chứng vận hành phù hợp |

### 4.3. Lựa chọn mở rộng cần quyết định riêng

| Chủ đề | Baseline | Mở rộng chưa triển khai |
|---|---|---|
| Người ăn | User active trong job | Enrollment theo ngày, tách role/tư cách ăn |
| Cắt | Ba loại tự duyệt; cắt trực tiếp sau giờ đóng có pending | Thống nhất luồng; đổi chính sách duyệt nếu cần |
| Khách | Confirmed trên registration | Guest request/duyệt độc lập |
| Công nợ | Nhập thủ công/mark-paid | Phí từ suất, giá snapshot, thu/đảo/khóa kỳ |
| Thông báo | DB inbox đồng bộ | Outbox, device token, FCM |
| Identity | Token trên user | Session/jti, chính sách login cạnh tranh |
| Import | Batch JSON | Excel upload, preview/commit theo batch ID |
| Quyền | Role allowlist | Permission catalog chi tiết |
| Triển khai | Một process API/cron | Worker, lease, CI/CD, backup/restore |

Không cần đổi .NET/PostgreSQL để tài liệu khớp API. Khi chọn mở rộng, cập nhật hành vi, schema, route và kịch bản kiểm thử trước khi tuyên bố hoàn tất.

### 4.4. Duy trì tài liệu

Đổi API phải cập nhật FR, endpoint/body/response, trạng thái và AC liên quan. Chỉ đóng GAP khi có thay đổi thực tế và bằng chứng kiểm tra. Khi comment khác code, theo code và ghi vấn đề; không suy tính năng từ tên endpoint hoặc dependency.
