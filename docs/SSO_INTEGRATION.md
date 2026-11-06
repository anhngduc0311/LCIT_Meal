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
- Grant: Authorization Code; response mode `query`; scope `openid phone`.
- Yêu cầu claim: `claims={"userinfo":{"sdt":{"essential":true}}}`.
- PKCE: `S256`; xác thực token endpoint: `client_secret_post`
  (có thể cấu hình `client_secret_basic` nếu được VNPT yêu cầu).
- Yêu cầu cấp `client_id`, `client_secret`, đăng ký callback chính xác và trả
  claim `sdt` (số điện thoại) trong UserInfo cho scope `profile`.

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

Theo yêu cầu chủ hệ thống ngày 06/11/2026, đăng nhập SSO đối chiếu claim `sdt`
trong UserInfo đã xác thực với `phone` của bảng user trên PostgreSQL Neon:

- Không giới hạn cơ sở: đối chiếu user ở mọi cơ sở.
- Chuẩn hóa số Việt Nam dạng 0..., +84..., 84... hoặc 0084... về dạng 0...;
  chấp nhận khoảng trắng, dấu chấm/gạch nối/ngoặc định dạng, từ chối số sai hoặc thiếu số 0.
- Chỉ cho phép duy nhất một tài khoản trùng số và đang hoạt động. Thiếu/sai số,
  không khớp, trùng nhiều tài khoản hoặc tài khoản khóa đều bị chặn.
- Kiểm tra lại điều kiện khi đổi ticket; giữ ID và quyền trong database.
  Không tạo user, tự điền số từ SSO hoặc dùng groups/role từ SSO.
- Không dùng họ tên hoặc file liên kết thủ công cũ để bỏ qua điều kiện số điện thoại.
  Các biến `SSO_ACCOUNT_LINKS_FILE` và `SSO_LINK_REQUESTS_FILE` cũ không còn tác dụng.

## Lưu số điện thoại

Chạy migration PostgreSQL `sql/migrations/003_user_phone_postgres.sql` trước khi
phát hành API: thêm cột phone nullable và unique index. Schema đầy đủ
`sql/postgres.sql` cũng bao gồm thay đổi này. Không đổi các user/role hiện có.

Quản trị vào **Quản lý hệ thống → Người dùng → Sửa**, nhập số đã xác nhận rồi
lưu. Có thể nhập khi tạo user hoặc import Excel với cột `phone`, `sdt` hoặc
`Số điện thoại` (để kiểu văn bản để giữ số 0 đầu). Có thể xóa số bằng cách để trống.
Số được chuẩn hóa trước khi lưu; số đã dùng bởi user khác bị từ chối. Request từ
app cũ không gửi phone vẫn giữ giá trị đang lưu. Người dùng đã đăng nhập có thể cập nhật hoặc xóa số của chính mình qua
PATCH /api/users/me; API kiểm tra định dạng và số trùng, không cho đổi username,
role hoặc status. App gửi phone và lưu lại giá trị chuẩn hóa API trả về.

Các user hiện có ban đầu chưa có số điện thoại. Cần quản trị nhập dữ liệu đã xác
nhận trước khi họ dùng SSO; không tự gán sdt nhận được cho datnt hay bất kỳ user nào.

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
5. Sau khi tìm thấy duy nhất user đang hoạt động trùng số điện thoại, backend chuyển về `/auth/sso/callback` của web với
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

Cổng SSO thực tế có trả `sdt`, chưa trả `name`; vì vậy phiên bản này chuyển sang
đối chiếu số điện thoại theo yêu cầu chủ hệ thống. Các kiểm thử tự động bao phủ số
khớp/không khớp, thiếu/sai số, các định dạng 0/+84, trùng nhiều user, tài khoản khóa,
thay đổi dữ liệu trước khi đổi ticket, và bảo toàn quyền. Kiểm thử PostgreSQL dùng
schema riêng để kiểm tra tạo/sửa/xóa số, trùng số, import và giới hạn quản trị.
Bản TestFlight của app không đổi.

Triển khai Viettel ngày 06/11/2026: migration phone đã áp dụng, 53 user và toàn bộ
phân quyền cũ được giữ nguyên; chưa có user nào được tự gán số điện thoại. Web build
thành công; 19 kiểm thử auth/SSO và 131 kiểm tra PostgreSQL trong schema riêng đạt.
Đăng nhập SSO thực tế với một user có số đã xác nhận cần được kiểm tra sau khi quản
trị nhập số vào màn hình Người dùng.
