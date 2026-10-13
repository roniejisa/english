# Kết quả kiểm thử bản 2.0

- Next.js 16.4.0 build production: thành công, xuất static `out/`.
- TypeScript strict: thành công.
- 18 nhóm kiểm thử tự động: thành công.
- 42 bài nhỏ, 49 bước gồm 7 trạm; ID và thứ tự không trùng, giữ từ v1.1.
- 42 truyện riêng 50–100 từ; 420 câu hỏi; 12 hội thoại đủ audio cả hai vai.
- Luyện tập không mở khóa; chọn từ bài đã mở; sổ lỗi dựa trên lần trả lời mới nhất.
- Database v1.1 được nâng lên v2 mà điểm, tên, mục tiêu và thời gian không đổi.
- Lượt nộp cùng request ID trả cùng kết quả; payload khác dùng lại ID bị từ chối.
- Đề 6 câu cũ tiếp tục được chấm sau khi nạp đề 10 câu mới.
- Kiểm tra ngưỡng 79/80%, toàn bộ bài trước và yêu cầu tham gia nói ở cột mốc.
- Chấm câu nghe bỏ qua hoa/thường và dấu câu, vẫn kiểm tra thứ tự từ.
- Đề cột mốc 9 câu, chia đều ngữ pháp/nghe/đọc, không lặp ID.
- Mỗi bài đọc 50–100 từ, có 3 câu hỏi và glossary phủ mọi từ.
- 126 thẻ từ đều có hình, IPA, ngữ cảnh và file nghe.
- 407 MP3 được đóng gói; file không rỗng; 23 từ có bản thu người thật, 103 từ dùng giọng tổng hợp được ghi nhãn.
- Timestamps phủ mọi từ bài đọc, chạy tăng dần; chênh lệch từ cuối với cuối file audio khoảng 0.14–0.19 giây do khoảng nghỉ/encoding.
- Service worker hợp lệ về cú pháp; static HTML tham chiếu đúng tài nguyên hiện hữu.
- PGlite chạy migration PostgreSQL thực: RLS giữa 2 người học; không tự ghi điểm; khóa server; seed quản trị; phiên ngẫu nhiên; ngăn nộp lại sinh trùng attempt; quota 20 lượt chấm/ngày/người.
- Kiểm tra tiến độ import lỗi và lịch ôn quên/nhớ/ease.
- File cài Supabase một lần: chạy trên database mới và chạy lại thành công; 49 bước được nạp.
- Đồng bộ 2 thiết bị: cộng thời gian, không đếm hai lần khi gửi lại; số nhỏ hơn không ghi đè số lớn hơn.
- Khôi phục tên, mục tiêu và bước học; tài khoản khác không thấy dữ liệu.
- Chỉnh hồ sơ hoặc tăng thời gian trong lúc request đang chạy không bị mất khi nhận phản hồi.

## Trạng thái dịch vụ thực tế

Đã kiểm tra live dự án Supabase được cấp: khóa publishable hợp lệ, Auth email bật và cần xác nhận email. Database thực đã có bảng LingoStep v1.1; đã chuẩn bị file SQL cài đặt đầy đủ và kiểm thử trên PostgreSQL qua PGlite. Chưa chạy migration v2 trên dịch vụ thực do không có quyền quản trị SQL bằng publishable key. Azure vẫn chưa được cấu hình. Chưa có kiểm thử tương tác trực tiếp bằng trình duyệt được hỗ trợ trong môi trường làm việc: chưa xác nhận quyền micro, cài đặt PWA, quota cache và tương tác chạm trên các thiết bị cụ thể.

## Kiểm tra thực tế sau cài đặt

1. Đi toàn bộ luồng bài A0 đầu; trả lời sai để xem giải thích, thử 4/6 và 5/6 để kiểm tra khóa.
2. Tải bài, chờ thông báo hoàn tất, tắt mạng, đóng/mở lại PWA và phát file nghe.
3. Thử 0.75×, byte-range audio trên Safari và tô sáng từng từ.
4. Cho phép/từ chối micro; thu ngắn và thu im lặng; kiểm tra dừng sau 30 giây.
5. Đăng ký 2 tài khoản Supabase; xác nhận email; đăng nhập/đăng xuất và kiểm tra dữ liệu giữ riêng.
6. Với Azure đã cấu hình: gửi một bản đọc đúng và một bản cố ý thiếu từ; đối chiếu kết quả; thử hạn mức.
7. Kiểm tra màn hình 360px, 390px, 768px, 1440px, bàn phím Tab/Escape và công cụ đọc màn hình.
