# Phân tích thiết kế và kiến trúc LingoStep

## 1. Biến ý tưởng thành một chu kỳ học cụ thể

Một bài kéo dài khoảng 12 phút: nhìn và nghe từ trong câu → học đúng một quy tắc → nghe/đọc câu chuyện → thu câu nhại → làm 6 câu có đáp án. Người mới không cần nhìn một bảng công thức dài. Những quy tắc dễ nhầm được tách thành các bài riêng: “I am”, “you are”, “she is”, “a”, “an”, thêm “s”; tiếp theo mới tới hiện tại đơn và trợ động từ.

Các bài sau đi từ hiện tại tiếp diễn, quá khứ, so sánh và dự định đến hiện tại hoàn thành, mệnh đề quan hệ, điều kiện, bị động, suy luận quá khứ, đảo ngữ và sắc thái imply/infer. Mỗi chặng có 6 bài và một trạm kiểm tra. Cột mốc ngẫu nhiên gồm 3 ngữ pháp, 3 nghe và 3 đọc; bước cuối yêu cầu một lượt thu âm nói.

**Điểm quan trọng về sư phạm:** vài mẫu ngữ pháp nâng cao không đủ tạo năng lực C2. C2 cần đọc/nghe nguồn dài, phản biện, diễn đạt linh hoạt, giao tiếp không có lời thoại sẵn và phản hồi cá nhân. Các nhãn cấp trong sản phẩm đầu tiên là khung tổ chức nội dung, không phải kết quả phân loại trình độ người học.

## 2. Ánh xạ tiêu chí tới hành vi ứng dụng

| Tiêu chí | Triển khai | Phạm vi cần lưu ý |
|---|---|---|
| Ngữ pháp khối Lego | 42 bài, mỗi bài một quy tắc ngắn và ví dụ nghe được | Cần mở rộng ngân hàng bài trước khi dùng như giáo trình đầy đủ |
| Từ có hình, IPA, file nghe | 42 thẻ; asset cục bộ; câu ví dụ và nghĩa Việt | Phân biệt audio bản ngữ và audio tổng hợp trên giao diện |
| Học trong ngữ cảnh | Mỗi từ có câu hoàn chỉnh; 7 truyện mini theo chặng | Câu truyện được tái sử dụng trong 6 bài của chặng |
| Giải thích lỗi ngay | Mỗi câu có đáp án và giải thích Việt 1–2 dòng | Giải thích dựa trên nội dung đã biên soạn, không phụ thuộc AI đoán lỗi |
| Dictation dễ | A0 có câu 3–5 từ, xếp từ hoặc gõ | Đáp án kiểm tra đúng thứ tự từ; không chấm dấu câu |
| Audio 0.75× | HTMLAudioElement playbackRate và preservesPitch | Cần trình duyệt có hỗ trợ; không kéo thấp cao độ giọng |
| Audiobook tô sáng | Timestamps từ alignment phoneme, chạy theo currentTime | Có thể cần biên tập thủ công nếu thay giọng/file thu người thật |
| Chạm dịch | Glossary cho từ trong 7 bài; popover ngay trong màn hình | Dịch theo ngữ cảnh bài; không phải từ điển tổng quát mọi nghĩa |
| Phân tích cấu trúc | Câu được biên tập với nhãn Chủ ngữ/Động từ/Tân ngữ; màu xanh/đỏ/vàng | Câu bị động có thể không có tân ngữ; phần bổ sung không cố tô màu |
| 2–3 câu đọc hiểu | 3 câu tiếng Anh/bài đọc; phản hồi Việt | Câu nâng cao kiểm tra hàm ý, không chỉ tìm từ trùng |
| IPA offline | 41 âm/biến thể giọng Mỹ, hướng dẫn, sơ đồ, file từ mẫu | Sơ đồ là khái quát; vị trí lưỡi chi tiết nằm trong hướng dẫn |
| Shadowing offline | Nghe → thu → nghe lại → sóng âm và chỉ số nhịp | Chỉ số nhịp không phải điểm phát âm |
| Chấm phát âm thật | Supabase Edge Function gọi Azure Speech, kết quả từ/phoneme | Cần mạng, Auth và secrets; chưa kiểm chứng live khi chưa có cấu hình |
| Role-play | Hội thoại quán cà phê 3 lượt; audio hai vai; thu lời đáp | Một tình huống có kịch bản, chưa có hội thoại tự do |
| Khóa 80% | Chấm local cho khách; RPC kiểm tra toàn bộ các bước trước cho tài khoản | Tài khoản không được ghi trực tiếp điểm; local có thể thay đổi bởi chủ thiết bị |
| Cột mốc 5–7 bài | Cứ 6 bài, đề chia theo kỹ năng và chọn ngẫu nhiên | Bước nói xác nhận tham gia; không cộng “điểm phát âm” chưa được đo |
| PWA | Manifest, icon, service worker theo hash build, app shell offline | Cần mở online trước; tải audio bài chủ động; cache không thay thế bản sao dữ liệu |
| Supabase | Auth, profiles, attempts, reviews, RLS, private answer keys, quiz sessions | Cần dự án Supabase thật để bật đồng bộ; bản khách dùng localStorage |

## 3. Vì sao tách điểm nhịp khỏi điểm phát âm?

Hai người có thể đọc đúng cùng một câu mà sóng âm khác nhau vì chất giọng, micro, phòng, khoảng cách và âm lượng. Ngược lại, một người đọc sai âm vẫn có nhịp giống câu mẫu. Dynamic Time Warping trên biên độ chỉ so sánh cấu trúc năng lượng theo thời gian. Không dùng con số này để khẳng định âm /æ/ hay /θ/ đúng.

Adapter Azure nhận WAV chuẩn, ReferenceText và granularity Phoneme; kết quả độ chính xác/trôi chảy/đầy đủ được hiển thị riêng. Người dùng chủ động gửi bản thu. Một mô hình offline thực sự cần nhận diện tiếng nói, căn chỉnh âm vị và mô hình đánh giá được hiệu chỉnh với người Việt; đây là bước phát triển tiếp, không giả lập bằng điểm ngẫu nhiên.

## 4. Thiết kế dữ liệu và trách nhiệm

| Dữ liệu | Nơi lưu | Ai có quyền |
|---|---|---|
| Nội dung, IPA, glossary, timestamps | JSON versioned + static assets | Mọi người đọc được |
| Tài khoản | Supabase Auth | Auth quản lý |
| Tên và mục tiêu học | profiles | Chủ tài khoản đọc/ghi |
| Điểm và câu trả lời tài khoản | attempts | Người học chỉ đọc bản thân; RPC ghi |
| Đáp án chuẩn và giải thích server | private.answer_keys | Client không đọc trực tiếp |
| Lộ trình và đề chuẩn | course_nodes/question_prompts | Client đọc; quản trị seed |
| Phiên kiểm tra ngẫu nhiên | private.quiz_sessions | RPC tạo và kiểm tra chủ phiên |
| Lịch ôn từ | reviews | Chủ tài khoản đọc/ghi |
| Hạn mức chấm âm | private.speech_usage | RPC cấp hạn mức |
| Bản thu | Bộ nhớ phiên trình duyệt | Không tải lên trước khi người dùng bấm gửi |
| Khách, thời gian tập trung | localStorage theo namespace người học | Thiết bị hiện tại |

Chấm server không nhận một tham số “điểm”. Server lấy đáp án chuẩn, kiểm tra đúng tập câu trong bài/phiên, kiểm tra điều kiện mở và tự tính điểm. Security definer có search_path rỗng, luôn kiểm tra auth.uid; quyền execute được giới hạn. Quiz session có chủ sở hữu, hạn 24 giờ và kết quả replay trả cùng attempt để không nhân bản điểm khi nộp lại.

## 5. Ôn cách quãng

Người học tự nhớ nghĩa trước khi mở đáp án. “Chưa nhớ” đưa về lịch 10 phút; “Hơi khó”/“Nhớ rõ” điều chỉnh ease, số lần nhớ và khoảng cách. Các lần đầu thường 1 ngày, 3 ngày, sau đó nhân ease. Đây là biến thể đơn giản của SM-2, đủ để tạo thói quen, chưa phải FSRS được hiệu chỉnh trên dữ liệu người học.

## 6. Các bước tiếp theo để đạt chất lượng đào tạo cao

1. Mở rộng nội dung có biên tập: hàng trăm bài, nhiều loại câu hỏi trong từng kỹ năng, bối cảnh đời sống và bài nghe nhiều người nói.
2. Bổ sung placement test được hiệu chỉnh, cho phép bắt đầu ở cấp phù hợp mà vẫn có đánh giá kỹ năng riêng.
3. Đa dạng bài đọc theo bài học; tăng từ vựng chủ động và bị động theo các cấp CEFR; thêm viết tự do và phản hồi có rubric.
4. Chấm phát âm live với tập người Việt; xác định lỗi /θ/, /ð/, phụ âm cuối và trọng âm; tránh xem transcript đúng là phát âm đúng.
5. Xây pipeline offline có model/audio native thật, căn chỉnh timestamps và kiểm thử trên điện thoại dung lượng thấp.
6. Công cụ biên soạn có duyệt nội dung, versioning, lựa chọn accent và quản lý quyền; analytics về loại lỗi để cải thiện chương trình.

Các bước này không được đánh dấu đã hoàn thành trong bản đầu tiên.

## 7. Tài liệu kỹ thuật đối chiếu

- [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [MDN preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)
- [Azure pronunciation assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)
