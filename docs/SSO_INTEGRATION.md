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
- Grant: Authorization Code; response mode `query`; scope `openid`.
- PKCE: `S256`; xác thực token endpoint: `client_secret_post`
  (có thể cấu hình `client_secret_basic` nếu được VNPT yêu cầu).
- Yêu cầu cấp `client_id`, `client_secret`, đăng ký callback chính xác và cung cấp
  cách xác định `sub` của cán bộ cho client Cơm365.

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
SSO_ACCOUNT_LINKS_FILE=/etc/com365/sso-account-links.json
SSO_LINK_REQUESTS_FILE=/etc/com365/sso-link-requests.json
```

Liên kết danh tính do quản trị xác nhận bằng file JSON trên server, không nằm trong
thư mục public hoặc Git. Mỗi cặp issuer/subject chỉ được liên kết một tài khoản:

```json
[
  {
    "issuer": "https://login.yenbai.gov.vn:443/oauth2/token",
    "subject": "SUB_DO_SSO_CAP_CHO_CLIENT_COM365",
    "userId": 123
  }
]
```

Thay các giá trị mẫu bằng `sub` thật và ID tài khoản Cơm365 đã xác minh.
Đặt quyền file `.env` và file liên kết là `600`, thư mục chứa là `700`.
Không suy đoán liên kết theo họ tên/email và không tự cấp quyền theo claim SSO.
Tài khoản chưa liên kết sẽ nhận thông báo liên hệ quản trị, không được tự tạo.

Khi bật `SSO_LINK_REQUESTS_FILE`, những danh tính đã qua kiểm tra OIDC và UserInfo
nhưng chưa liên kết được ghi vào file riêng ở quyền 600. Mỗi lần có một `requestId`
ngẫu nhiên, cùng issuer, subject và thời điểm; không ghi access token hoặc ID token.
Trang lỗi có mã `sso_link_request` để quản trị đối chiếu đúng lần đăng nhập vừa
thực hiện, tránh chọn nhầm người trong nhiều yêu cầu đồng thời. Hàng đợi giữ tối đa
100 lần gần nhất, không tự cấp quyền hay tự thêm liên kết.

Ngày 06/11/2026, đã liên kết tài khoản eGov do chủ hệ thống cung cấp với `datnt`
(ID 26, quyền employee), sau khi đối chiếu đúng requestId của lần đăng nhập đã được
người dùng hoàn tất trên cổng SSO. Đã kiểm thử đăng nhập SSO thực tế thành công trên
web Cơm365 và xác nhận giao diện cán bộ. Các tài khoản khác cần liên kết riêng.

Sau khi điền cấu hình, liên kết tài khoản thử và xác nhận callback với VNPT,
đặt `SSO_ENABLED=true`, restart API và build/phát hành web. Giữ nguyên `JWT_SECRET`
và PostgreSQL Neon hiện có. CORS cần cho phép đúng `SSO_FRONTEND_ORIGIN` cùng credentials.

## Luồng đã chuẩn bị

1. Web kiểm tra `GET /api/auth/sso/config`; nếu chưa cấu hình thì giải thích rõ và
   vẫn cho phép đăng nhập tài khoản Cơm365 thông thường.
2. `GET /api/auth/sso/start` tạo state/nonce/PKCE, đặt cookie HttpOnly Secure
   SameSite=Lax và chuyển người dùng sang cổng SSO.
3. Cổng SSO xử lý mật khẩu, CAPTCHA và sự đồng ý của người dùng trên miền của cổng.
4. Callback kiểm tra cookie/state, đổi code ở backend, kiểm tra chữ ký RS256, issuer,
   audience, nonce và hạn ID token; gọi UserInfo bằng POST và kiểm tra `sub` trùng khớp.
5. Sau khi tìm thấy liên kết, backend chuyển về `/auth/sso/callback` của web với
   mã dùng một lần trong fragment; không đặt access token, ID token hoặc JWT Cơm365 lên URL.
6. Web xóa fragment rồi đổi mã bằng POST kèm cookie. Mã hết hạn sau một phút,
   chỉ dùng một lần và chỉ từ đúng origin/trình duyệt. Backend kiểm tra lại trạng thái
   tài khoản và cấp phiên Cơm365 với quyền hiện có; phiên mới thay thế phiên cũ như đăng nhập thường.

Đăng xuất hiện tại thu hồi phiên **Cơm365**. Bản chuẩn bị này chưa triển khai đăng xuất
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
