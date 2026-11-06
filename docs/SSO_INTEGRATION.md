# Tích hợp đăng nhập SSO Lào Cai cho Cơm365

Phần tích hợp web đã được triển khai trên máy chủ Viettel. Client riêng đã được
cấu hình bằng biến môi trường riêng trên server; key/secret không nằm trong Git.
Mặc định của mã nguồn vẫn là **SSO_ENABLED=false** cho môi trường mới.
Không dùng tài khoản eGov, mật khẩu người dùng hoặc client của hệ thống eGov
thay cho thông tin ứng dụng Cơm365.

## Thông tin gửi đơn vị quản lý SSO

- Ứng dụng: Cơm365 LCIT, web confidential client.
- Website: `https://com365.lcit.vn`.
- Callback GET: `https://com365.lcit.vn:4002/api/auth/sso/callback`.
- Grant: Authorization Code; response mode `query`; scope `openid profile`.
- PKCE: `S256`; xác thực token endpoint: `client_secret_post`
  (có thể cấu hình `client_secret_basic` nếu được VNPT yêu cầu).
- Yêu cầu cấp `client_id`, `client_secret`, đăng ký callback chính xác và trả
  claim `name` (họ tên) trong UserInfo cho scope `profile`.

Tài liệu cung cấp có một số ví dụ cũ ghi NBH/Ninh Bình và token mẫu của hệ thống
khác. Không sử dụng client, secret, token hay issuer trong các ví dụ đó để đăng nhập.

## Endpoint đã đối chiếu

Tài liệu Word và metadata công khai của cổng đang hoạt động cùng chỉ tới:

| Thành phần | Giá trị |
| --- | --- |
| Discovery | `https://login.yenbai.gov.vn/oauth2/oidcdiscovery/.well-known/openid-configuration` |
| Issuer chính xác | `https://login.yenbai.gov.vn:443/oauth2/token` |
| Authorization | `https://login.yenbai.gov.vn:443/oauth2/authorize` |
| Token | `https://login.yenbai.gov.vn:443/oauth2/token` |
| UserInfo POST | `https://login.yenbai.gov.vn:443/oauth2/userinfo` |
| JWKS | `https://login.yenbai.gov.vn:443/oauth2/jwks` |

Issuer phải giữ nguyên `:443` như metadata/ID token. Cổng công bố PKCE S256,
ID token RS256 và subject dạng `pairwise`: `sub` của một người trên ứng dụng eGov
có thể khác `sub` cấp cho Cơm365.

## Cấu hình backend sau khi được cấp client

Dùng Node.js 22 trên máy chủ Viettel như triển khai hiện tại. Chạy `npm ci` theo
package-lock mới để cài `openid-client`. Chỉ lưu thông tin sau ở `.env` của API:

```dotenv
SSO_ENABLED=false
SSO_DISCOVERY_URL=https://login.yenbai.gov.vn/oauth2/oidcdiscovery/.well-known/openid-configuration
SSO_ISSUER=https://login.yenbai.gov.vn:443/oauth2/token
SSO_CLIENT_ID=
SSO_CLIENT_SECRET=
SSO_TOKEN_AUTH_METHOD=client_secret_post
SSO_REDIRECT_URI=https://com365.lcit.vn:4002/api/auth/sso/callback
SSO_FRONTEND_ORIGIN=https://com365.lcit.vn
```

Theo yêu cầu chủ hệ thống ngày 06/11/2026, đăng nhập SSO đối chiếu claim `name`
trong UserInfo đã xác thực với `full_name` của bảng user trên PostgreSQL Neon:

- Không giới hạn cơ sở 1: tài khoản ở mọi cơ sở đều được đối chiếu.
- Chỉ chuẩn hóa Unicode NFC, chữ hoa/thường và khoảng trắng; giữ nguyên dấu và thứ tự tên.
- Chỉ cho phép đúng một tài khoản trùng tên và đang hoạt động. Thiếu họ tên, không
  khớp, trùng nhiều tài khoản hoặc tài khoản bị khóa đều bị chặn.
- Kiểm tra lại điều kiện khi đổi ticket; sử dụng ID, quyền và dữ liệu sẵn có của user.
  Không tạo user mới, đổi họ tên, đổi quyền hoặc dùng groups/role từ SSO.
- File liên kết thủ công cũ không còn được đọc, kể cả liên kết riêng với datnt.
  Các biến `SSO_ACCOUNT_LINKS_FILE` và `SSO_LINK_REQUESTS_FILE` cũ không còn tác dụng.
- Database hiện có 53 user, chưa phát hiện họ tên trùng sau chuẩn hóa; datnt có họ tên
  Nguyễn Tiến Đạt, quyền employee. Không thay đổi bản ghi hay phân quyền để triển khai.

Sau khi điền cấu hình và xác nhận callback với VNPT,
đặt `SSO_ENABLED=true`, restart API và build/phát hành web. Giữ nguyên `JWT_SECRET`
và PostgreSQL Neon hiện có. CORS cần cho phép đúng `SSO_FRONTEND_ORIGIN` cùng credentials.

## Luồng đăng nhập

1. Web kiểm tra `GET /api/auth/sso/config`; nếu chưa cấu hình thì giải thích rõ và
   vẫn cho phép đăng nhập tài khoản Cơm365 thông thường.
2. `GET /api/auth/sso/start` tạo state/nonce/PKCE, đặt cookie HttpOnly Secure
   SameSite=Lax và chuyển người dùng sang cổng SSO.
3. Cổng SSO xử lý mật khẩu, CAPTCHA và sự đồng ý của người dùng trên miền của cổng.
4. Callback kiểm tra cookie/state, đổi code ở backend, kiểm tra chữ ký RS256, issuer,
   audience, nonce và hạn ID token; gọi UserInfo bằng POST và kiểm tra `sub` trùng khớp.
5. Sau khi tìm thấy duy nhất user đang hoạt động trùng họ tên, backend chuyển về `/auth/sso/callback` của web với
   mã dùng một lần trong fragment; không đặt access token, ID token hoặc JWT Cơm365 lên URL.
6. Web xóa fragment rồi đổi mã bằng POST kèm cookie. Mã hết hạn sau một phút,
   chỉ dùng một lần và chỉ từ đúng origin/trình duyệt. Backend kiểm tra lại trạng thái
   tài khoản và cấp phiên Cơm365 với quyền hiện có; phiên mới thay thế phiên cũ như đăng nhập thường.

Đăng xuất hiện tại thu hồi phiên **Cơm365**. Tích hợp này chưa triển khai đăng xuất
toàn cổng SSO, lưu refresh token hoặc back-channel logout. Nếu VNPT bắt buộc back-channel
logout, cần thêm tài liệu chuyên biệt mà hướng dẫn Word có nhắc tới trước khi bật chính thức.

State và mã bàn giao hiện lưu trong bộ nhớ của một tiến trình API, phù hợp Supervisor
một tiến trình hiện tại. Restart làm hủy các luồng đăng nhập đang thực hiện. Nếu chạy nhiều
instance thì cần chuyển kho tạm sang Redis hoặc kho dùng chung có thao tác lấy một lần.

## Kiểm thử trước khi kích hoạt

```bash
cd lcit-meal-api
node --test scripts/tests/sso.test.cjs scripts/tests/auth.test.cjs
```

Các bài kiểm tra dùng thư viện OIDC thật và token RSA của máy chủ giả lập, kiểm tra
chữ ký sai, issuer/audience/nonce sai, token hết hạn, UserInfo sai người, state/mã bị
phát lại, origin/cookie sai, tài khoản khóa và tài khoản chưa liên kết.

Đã kiểm thử thực tế đăng nhập cán bộ bằng `datnt`, gồm bước người dùng nhập CAPTCHA
và chuyển về Cơm365. Quyền quanly, hủy đăng nhập, phiên hết hạn và đăng xuất cần kiểm
thử thực tế riêng; kết quả giả lập không thay thế các bước đó. Giao diện và bản
TestFlight của app không đổi.
