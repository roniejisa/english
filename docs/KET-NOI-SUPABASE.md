# Bật lưu dữ liệu trên Supabase của bạn

Ứng dụng đã được cấu hình cho dự án `ahgksphoavprrdbohjzx`. Khóa publishable chỉ dùng để kết nối client; nó không có quyền tạo bảng.

## Bước 1 — Tạo database học tập (chỉ một lần)

1. Mở [Supabase SQL Editor của dự án](https://supabase.com/dashboard/project/ahgksphoavprrdbohjzx/sql/new).
2. Mở file `supabase/LingoStep-Supabase-Setup.sql` trong bộ ZIP bằng VS Code hoặc Notepad.
3. Copy **toàn bộ** nội dung vào SQL Editor, rồi bấm **Run**.
4. Sau khi thành công, kết quả cuối cho biết `learning_nodes = 49`; một bảng kết quả khác cho biết số câu hỏi đã nạp.

File v2.2 bao gồm 6 migration và dữ liệu chuẩn của ứng dụng. Không phải chạy seed từ Terminal và không cần gửi service-role key. Có thể chạy lại file sau khi cài thành công để cập nhật bộ nội dung; file không xóa dữ liệu người học.

## Bước 2 — Đặt đường dẫn xác nhận email

Trong Supabase: **Authentication → URL Configuration**.

- **Site URL:** `https://lingo-step-english.truongtrungcaphanoi3.chatgpt.site`
- **Redirect URLs:** thêm URL trên. Nếu chạy localhost, thêm `http://localhost:3000`.

Dự án hiện bật xác nhận email: sau khi đăng ký, người học cần mở email xác nhận rồi quay lại ứng dụng để đăng nhập. Cấu hình SMTP của dự án nếu gửi xác nhận email không thành công hoặc bị giới hạn. Thao tác này không thể thực hiện bằng publishable key.

## Bước 3 — Dùng cùng một tài khoản ở mọi nơi

Mở [LingoStep](https://lingo-step-english.truongtrungcaphanoi3.chatgpt.site), chọn **Đăng nhập / tạo tài khoản**. Trên máy/điện thoại khác, đăng nhập **cùng email**.

Ứng dụng lưu trên Supabase:

- Lịch sử làm bài, điểm do server chấm và bước đã mở khóa.
- Từ đã học, lịch ôn và kết quả ôn từ.
- Tên, mục tiêu mỗi ngày.
- Thời gian học theo ngày, cộng từ các thiết bị mà không nhân đôi một lượt đồng bộ.
- Bài học và bước gần nhất để tiếp tục khi mở lại bài.
- Lịch sử trạm luyện tập, kết quả luyện viết và bản nháp đã bấm lưu lên tài khoản.
- Bộ1.217 từ, từ đã lưu, kết quả luyện từ và lịch ôn thư viện (sau SQL v2.2).

Trong **Cài đặt → Tài khoản & đồng bộ**, xem trạng thái **Đã lưu trên Supabase** và dùng **Đồng bộ ngay** khi cần. Tự tải tiến độ khi đăng nhập, trở lại tab, có mạng trở lại và mỗi 45 giây lúc ứng dụng hiển thị.

Thời gian học được giữ cục bộ sau mỗi 15 giây và gửi theo tổng của từng thiết bị; gửi lại cùng dữ liệu không làm tăng thời gian hai lần. Tên/mục tiêu/vị trí bài được lưu tự động sau khi thay đổi. Nếu mất mạng, thông tin này được giữ trên thiết bị và thử gửi khi có mạng. Kết quả tài khoản được giữ trong hàng chờ khi mất mạng và chỉ được xác nhận sau khi máy chủ chấm. Vào Luyện viết để gửi các lượt viết còn chờ; nháp viết tự lưu trên thiết bị, bấm Lưu nháp lên tài khoản để tiếp tục trên thiết bị khác.

## Tiến độ đã học ở chế độ khách

Tiến độ khách trước khi đăng nhập vẫn được giữ trên thiết bị, tách biệt với điểm do server chấm. Bản cập nhật không tự nhập điểm khách vào tài khoản. Muốn tiếp tục đồng bộ từ đầu trên các thiết bị, hãy làm bài trong tài khoản đã đăng nhập. Chức năng xuất JSON vẫn giữ được bản sao tiến độ khách.

## Kiểm tra

1. Đăng nhập trên thiết bị A, đổi tên/mục tiêu và làm một bài đạt 80%.
2. Đăng nhập cùng tài khoản trên thiết bị B; kết quả và bài mở khóa phải xuất hiện.
3. Đọc/nghe 1–2 phút trên A rồi bấm Đồng bộ ngay; quay lại tab B để lấy thời gian cập nhật.
4. Đăng nhập tài khoản khác: không thấy dữ liệu của tài khoản trước.

Tài khoản Supabase không tự mở quyền truy cập website cho người khác: bản website hiện vẫn giữ quyền riêng tư của chủ ứng dụng.
