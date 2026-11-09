# Hướng dẫn sử dụng LCIT Meal theo từng vai trò

Cập nhật ngày **09/11/2026**, bổ sung cách đăng nhập với SSO trên web và điện thoại. Ảnh minh họa trong các hướng dẫn theo vai trò được chụp ngày **27/10/2026**. Số suất, khoản thu và số thông báo trong ảnh là dữ liệu tại thời điểm chụp.

## Chọn đúng hướng dẫn

| Bạn đang dùng tài khoản | Vai trò trên ứng dụng | Tài liệu |
| --- | --- | --- |
| `anhnd` | Nhân viên | [Hướng dẫn Nhân viên](docs/HUONG_DAN_NHAN_VIEN.md) |
| `quanlybep` | Quản lý bếp | [Hướng dẫn Bếp](docs/HUONG_DAN_BEP.md) |
| `admin` | Quản trị viên | [Hướng dẫn Admin](docs/HUONG_DAN_ADMIN.md) |

**“Bếp” trong bộ hướng dẫn này là tài khoản `quanlybep`, có quyền Quản lý (Manager).** Nút lọc **Bếp** trong danh sách người dùng lại chỉ vai trò **Nhân viên bếp (Kitchen)**. Hai vai trò này khác nhau; xem cách tìm đúng tài khoản tại [hướng dẫn Admin](docs/HUONG_DAN_ADMIN.md#2-tìm-tài-khoản-và-hiểu-bộ-lọc).

## Đăng nhập và đăng xuất

Mở [Cơm365 trên web](https://com365.lcit.vn) hoặc ứng dụng **LCIT Meal** do cơ quan cung cấp.

### Dùng tài khoản Cơm365

Nhập **Tên đăng nhập** và **Mật khẩu** được cấp, rồi bấm **Đăng nhập**. Mật khẩu do người quản trị cấp riêng.

### Dùng SSO của cơ quan

1. Bấm **Đăng nhập với SSO** trên màn hình đăng nhập. Trên điện thoại, dùng bản LCIT Meal được cơ quan cung cấp, chẳng hạn bản thử nghiệm qua TestFlight nếu đã được mời.
2. Đăng nhập bằng tài khoản cơ quan trên cổng SSO và hoàn tất các bước xác thực theo yêu cầu của cổng.
3. Khi cổng chuyển về Cơm365, kiểm tra thông tin tài khoản trong **Hồ sơ người dùng** trên web hoặc **Tài khoản** trên điện thoại.

Cơm365 dùng số điện thoại do cổng SSO cung cấp để tìm đúng một tài khoản đang hoạt động. Quyền sử dụng vẫn theo tài khoản Cơm365 đã được cấp.

| Thông báo hoặc tình huống | Cách xử lý |
| --- | --- |
| Cổng SSO chưa cung cấp số điện thoại hợp lệ | Liên hệ quản trị SSO để kiểm tra số điện thoại trên tài khoản cơ quan. |
| Số điện thoại SSO không khớp với tài khoản đang hoạt động | Liên hệ quản trị Cơm365 để kiểm tra số điện thoại và trạng thái tài khoản. |
| SSO đang chờ cấu hình | Dùng tên đăng nhập và mật khẩu Cơm365 đã được cấp. |
| Phiên SSO hết hạn hoặc chưa hoàn tất | Quay lại màn hình đăng nhập và bấm **Đăng nhập với SSO** để thử lại. |

Nếu đăng nhập được bằng mật khẩu trên điện thoại, bạn có thể kiểm tra hoặc cập nhật số tại **Tài khoản → Chỉnh sửa thông tin & Đổi mật khẩu → Số điện thoại → Lưu thay đổi**. Trên web, quản trị viên có thể cập nhật tại **Quản lý hệ thống → Quản lý người dùng → Sửa → Số điện thoại**.

### Đổi tài khoản

- **Trên web** chọn **Đăng xuất** ở menu bên và xác nhận.
- **Trên điện thoại** vào **Tài khoản → Đăng xuất**, rồi bấm **Đăng xuất** trong hộp xác nhận.

Sau đó đăng nhập bằng tài khoản cần dùng.

## Những điểm cần nhớ

- **Nhân viên:** kiểm tra suất hôm nay; nếu không ăn, cắt trước **08:00 sáng giờ Việt Nam**. Khi nút bị mờ và ghi **Quá hạn cắt suất**, ngày đó đã hết hạn thao tác.
- **Bếp:** kiểm tra đúng **ngày** và **cơ sở** trước khi lấy số suất cần nấu.
- **Admin:** kiểm tra bộ lọc cơ sở cùng vai trò khi tìm tài khoản.
- **Chờ duyệt** chưa có nghĩa là đã cắt suất.
- Nút **Đã chuyển** trong cửa sổ QR chỉ đóng cửa sổ; trạng thái thu tiền cần người quản lý đối soát và xác nhận.
- Phân cơ sở hiện được lưu **trên thiết bị/trình duyệt đang dùng**. Nếu đổi thiết bị hoặc xóa dữ liệu trình duyệt, cần kiểm tra lại.
- Số suất cần chuẩn bị và biểu đồ suất đã hoàn thành phục vụ hai mục đích khác nhau; không dùng thay cho nhau.

## Phạm vi đối chiếu

Phiên kiểm tra ngày **27/10/2026** đã đăng nhập đủ ba tài khoản, mở các màn hình chính và các biểu mẫu liên quan. Phiên này đã kiểm tra tên nút, đường đi, bộ lọc, thông báo quá hạn và cách tìm `quanlybep` trong Admin.

Phần SSO trong bản cập nhật được đối chiếu với mã ứng dụng web, ứng dụng điện thoại và tài liệu tích hợp. Chưa kiểm tra trực tiếp bằng tài khoản SSO thật trong lần cập nhật này.

Các bước lưu dữ liệu trong hướng dẫn được đối chiếu thêm với phần xử lý hiện có của ứng dụng. Phiên kiểm tra tài liệu dừng trước thao tác gửi cắt suất, tạo tài khoản, xác nhận thu tiền, phát thông báo, đổi cấu hình hoặc chạy tiến trình quản trị; chưa kiểm chứng kết quả lưu của các thao tác này. Tại lúc kiểm tra không có yêu cầu chờ duyệt để thực hiện luồng duyệt thực tế.

Ảnh minh họa:

![Trang điều hành của tài khoản quản lý bếp](docs/images/huong-dan-roles/bep-dieu-hanh.png)
