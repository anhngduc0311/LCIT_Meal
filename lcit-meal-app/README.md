# LCIT Meal App

Giao diện web cho hệ thống quản lý suất ăn nội bộ: cán bộ đăng ký / cắt suất ăn,
quản lý theo dõi lịch bếp ăn, thanh toán, thông báo và cấu hình hệ thống.

Stack: **React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router 8**.

Backend đi kèm: [`lcit-meal-api`](#) — cần chạy trước khi khởi động app.

---

## 1. Yêu cầu môi trường

| Thành phần | Phiên bản khuyến nghị |
| ---------- | --------------------- |
| Node.js    | >= 20                 |
| npm        | >= 10                 |

---

## 2. Cài đặt & chạy

```bash
npm install
cp .env.example .env     # chỉnh VITE_API_BASE_URL nếu API không chạy ở localhost:3000
npm run dev              # chạy dev tại http://localhost:5173
npm run build            # type-check (tsc -b) + build production vào dist/
npm run preview          # xem thử bản build
npm run lint             # kiểm tra ESLint
```

> API đang cấu hình CORS cho `http://localhost:5173`. Nếu chạy dev ở cổng khác,
> nhớ sửa `origin` trong `src/app.js` của backend.

---

## 3. Biến môi trường (`.env`)

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Toàn bộ request trong `src/api/services/*.ts` được nối vào sau giá trị này.
Khi frontend deploy sau cùng một host với API, có thể đặt `VITE_API_BASE_URL=/api`.

---

## 4. Phân quyền & điều hướng

Ma trận quyền khai báo tập trung tại `src/constants/roles.ts`, dùng **chung** cho
cả `ProtectedRoute` (`App.tsx`) và menu (`AppSidebar.tsx`) để hai nơi không lệch
nhau.

| Nhóm              | Bao gồm                  | Ý nghĩa                                                |
| ----------------- | ------------------------ | ------------------------------------------------------ |
| `STAFF`           | admin, manager, employee | Mọi vai trò trừ bếp                                    |
| `MANAGER_UP`      | admin, manager           | Quyền quản lý                                          |
| `ADMIN_ONLY`      | admin                    | Chỉ quản trị viên                                      |
| `SELF_MEAL_ROLES` | manager, employee        | Người **thực sự ăn** và tự đăng ký / cắt suất cho mình |

Điểm cần lưu ý:

- **Admin không thuộc `SELF_MEAL_ROLES`.** Admin là tài khoản quản trị thuần túy,
  không tự đăng ký / cắt suất / thanh toán cho bản thân — chỉ thao tác hộ người
  khác qua trang _Lịch ăn_. Trang chủ của admin cũng ẩn khối "Thanh toán của tôi".
- **Bếp (`kitchen`)** chỉ vào được trang chủ để biết số suất cần nấu.

### Trang chủ theo vai trò

Route `/` trỏ tới `src/pages/HomeRouter.tsx`, quyết định nội dung theo role:

| Vai trò           | Trang chủ khi đăng nhập                            |
| ----------------- | -------------------------------------------------- |
| manager, employee | **Đăng ký / Cắt suất ăn** (việc cần làm hàng ngày) |
| admin, kitchen    | Dashboard tổng quan                                |

---

## 5. Danh sách trang

| Đường dẫn                   | Trang                                         | Quyền             |
| --------------------------- | --------------------------------------------- | ----------------- |
| `/`                         | Trang chủ (theo vai trò)                      | Mọi role          |
| `/meal-registration`        | Đăng ký / Cắt suất ăn                         | manager, employee |
| `/meal-schedule`            | Lịch ăn (đăng ký / cắt suất hộ)               | STAFF             |
| `/reports`                  | Báo cáo / Thống kê (tab suất ăn & thanh toán) | MANAGER_UP        |
| `/user-management`          | Quản lý người dùng                            | MANAGER_UP        |
| `/notification-management`  | Quản lý thông báo                             | MANAGER_UP        |
| `/meal-option-management`   | Theo dõi cắt suất ăn                          | MANAGER_UP        |
| `/holiday-event-management` | Hủy lịch (nghỉ lễ / sự kiện)                  | MANAGER_UP        |
| `/setting-management`       | Quản lý cấu hình                              | ADMIN_ONLY        |
| `/permission-management`    | Quản lý quyền hệ thống                        | ADMIN_ONLY        |
| `/audit-log`                | Lịch sử hệ thống                              | ADMIN_ONLY        |
| `/profile`                  | Hồ sơ người dùng                              | Mọi role          |
| `/login`                    | Đăng nhập                                     | Public            |

Các trang ngoài trang chủ đều được tách bundle riêng bằng `React.lazy`, giúp
trang đăng nhập / trang chủ tải nhanh hơn.

---

## 6. Nghiệp vụ trên giao diện

### 6.1 Đăng ký / cắt suất ăn (`/meal-registration`)

Gồm 3 khối: trạng thái suất ăn hôm nay, **Tùy chọn nhanh**, và lịch tháng.

Tùy chọn nhanh:

| Hành động                 | Mô tả                                             |
| ------------------------- | ------------------------------------------------- |
| Đăng ký lại suất ăn       | Đăng ký suất cho hôm nay                          |
| Cắt — Chỉ hôm nay         | Cắt suất hôm nay, tự động đăng ký lại từ ngày mai |
| Cắt hẳn từ hôm nay        | Cắt tới khi được quản lý xác nhận đăng ký ăn lại  |
| Cắt suất tùy chỉnh        | Cắt theo khoảng ngày tự chọn                      |
| Đăng ký suất ăn cho khách | Nhập số suất cho khách trong hôm nay (0–10)       |

**Cắt suất chỉ cần xác nhận, không qua duyệt** — sau khi bấm xác nhận là suất ăn
được cắt ngay. Quản lý chỉ nhận thông báo để điều chỉnh số suất cần nấu.

**Đăng ký suất cho khách cũng không cần duyệt** — được xác nhận ngay. Nhập `0` để
bỏ toàn bộ suất khách đã đăng ký. Nếu số khách không đổi thì modal đóng luôn,
không gọi API.

Lịch tháng cho phép bấm vào từng ngày để đăng ký / hủy, hiển thị `(+N khách)` khi
có đăng ký kèm khách.

### 6.2 Lịch ăn (`/meal-schedule`)

Dành cho quản lý: xem lịch bếp ăn theo tháng, đăng ký / cắt suất hộ cán bộ.
Danh sách cán bộ **đã lọc bỏ tài khoản admin** (khớp với ràng buộc ở backend).

Badge trạng thái mỗi ngày lấy từ trường `completionStatus` do API trả về:

| Badge         | Điều kiện                                       |
| ------------- | ----------------------------------------------- |
| Đã hủy        | Bếp ăn ngày đó bị hủy                           |
| Đã hoàn thành | Ngày đã qua, hoặc hôm nay đã qua giờ hoàn thành |
| Đang phục vụ  | Là hôm nay và chưa tới giờ hoàn thành           |
| Đang chờ      | Ngày trong tương lai                            |

Giờ hoàn thành lấy từ cấu hình `meal_completion_time`, đổi trong _Quản lý cấu hình_
là giao diện tự cập nhật theo, không cần deploy lại.

### 6.3 Theo dõi cắt suất ăn (`/meal-option-management`)

Do đã bỏ bước duyệt, trang này chủ yếu để **theo dõi** và **xác nhận đăng ký ăn lại**
cho người đã cắt hẳn. Bộ lọc mặc định là "Tất cả". Nút Duyệt / Từ chối vẫn còn để
xử lý nốt các yêu cầu cũ tạo trước khi đổi nghiệp vụ.

---

## 7. Cấu trúc thư mục

```
src/
├── main.tsx / App.tsx        # Entry + khai báo route
├── api/
│   ├── core/ApiClient.ts     # HTTP client dùng chung: JSON, bearer token, timeout
│   ├── core/ApiError.ts      # Kiểu lỗi chuẩn hóa cho UI
│   ├── services/             # Service theo domain: MealService, PaymentService...
│   ├── types/                # Kiểu dữ liệu dùng chung
│   ├── client.ts             # Singleton đã cấu hình sẵn
│   ├── config.ts             # Đọc VITE_API_BASE_URL (mặc định /api)
│   └── download.ts           # Tải file Excel từ API
├── components/
│   ├── meal/                 # MealCalendar, MealQuickActions, MealStatus...
│   ├── payments/, charts/, ui/, common/, form/...
│   └── ProtectedRoute.tsx    # Chặn route theo đăng nhập + role
├── constants/roles.ts        # Ma trận quyền dùng chung
├── context/                  # Auth, Theme, Sidebar, Notification, Confirm
├── hooks/                    # useConfirm, useModal, useNotification
├── layout/                   # AppLayout, AppSidebar, AppHeader
└── pages/                    # Mỗi nghiệp vụ 1 thư mục riêng
    ├── shared/               # Component & style dùng chung giữa các trang quản trị
    ├── Dashboard/, MealRegistration/, MealSchedule/
    ├── MealOption/, HolidayEvent/, Notification/
    ├── Permission/, AuditLog/, Reports/, Setting/, User/
    └── HomeRouter.tsx        # Chọn trang chủ theo vai trò
```

---

## 8. Quy ước code

**Gọi API:** luôn dùng service theo domain, không gọi `fetch` trực tiếp trong
component.

```ts
import { mealService, ApiError } from "@/api";

try {
  await mealService.register({ mealId, guestCount: 2 });
} catch (error) {
  showNotification(
    error instanceof ApiError ? error.message : "Có lỗi xảy ra",
    "error",
  );
}
```

**Xác nhận trước hành động nhạy cảm:** dùng `useConfirm()` thay cho
`window.confirm`.

```ts
const confirm = useConfirm();

const ok = await confirm({
  title: "Xác nhận hủy suất ăn",
  message: `Bạn có chắc chắn muốn hủy suất ăn ngày ${date}?`,
  confirmText: "Hủy suất ăn",
  variant: "danger",
});
if (!ok) return;
```

**Thông báo:** dùng `useNotification()` → `showNotification(message, "success" | "error")`.

**Alias import:** `@/` trỏ tới `src/` (cấu hình qua `vite-tsconfig-paths`).

**Phân quyền:** thêm route mới thì khai báo `allowedRoles` ở cả `App.tsx` và
`AppSidebar.tsx`, lấy nhóm quyền từ `src/constants/roles.ts` — không hard-code
chuỗi role.

---

## 9. Xác thực

- `AuthContext` giữ thông tin người dùng và token.
- `ApiClient` tự gắn header `Authorization: Bearer <token>`.
- Khi API trả `401`, client phát sự kiện DOM `auth:unauthorized`; `AuthContext`
  lắng nghe và tự đăng xuất — cách này giúp `ApiClient` (thuần TypeScript) không
  phụ thuộc vào React context.

---

## 10. Ghi chú khi triển khai

- `npm run build` chạy `tsc -b` trước, nên **mọi lỗi TypeScript đều làm build fail**
  (kể cả biến khai báo thừa). Nên chạy `npm run build` trước khi bàn giao.
- Sau khi build, deploy thư mục `dist/` lên web server tĩnh; nhớ cấu hình
  fallback về `index.html` để React Router hoạt động khi refresh trang.
- Đổi `VITE_API_BASE_URL` sang domain API thật và cập nhật `origin` CORS ở backend
  trước khi deploy.
