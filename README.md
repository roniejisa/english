# LingoStep 2.2 — Tiếng Anh từng bước

**Đang nâng cấp từ v1.1?** Xem `docs/V2.0-NANG-CAP.md` và chạy `supabase/LingoStep-v2.0-Upgrade.sql` để bật đồng bộ trạm luyện tập và hàng chờ offline. File giữ nguyên dữ liệu cũ.


Ứng dụng Next.js cho người Việt, với Supabase tùy chọn và PWA. Chạy ngay ở chế độ khách; tiến độ được lưu trên thiết bị. Bản v2.0 gồm **42 bài ngữ pháp nhỏ, 42 bài đọc 50–100 từ, 126 từ trọng tâm, 420 câu hỏi, 41 âm/biến thể IPA, 7 trạm kiểm tra và 12 hội thoại tình huống**.

Đây là bộ nội dung khởi đầu theo cấu trúc A0–C2, **chưa phải một giáo trình đủ để đưa người học tới C2**. A0 là nhãn nội bộ cho người bắt đầu; CEFR chính thức dùng A1–C2. Chấm phát âm qua dịch vụ cần cấu hình riêng; phần so sánh sóng âm offline chỉ ước lượng nhịp, không chứng minh phát âm đúng.

Xem hướng dẫn nâng cấp và các giới hạn tại `docs/V2.2-NANG-CAP.md`.

## 1. Chạy nhanh trên máy tính

Cài Node.js 22 hoặc mới hơn (khuyến nghị bản LTS). Giải nén mã nguồn, mở Terminal trong thư mục dự án:

```bash
npm ci
npm run dev
```

Mở http://localhost:3000. Trên Windows có thể chạy `scripts/start-windows.bat` sau khi cài Node.js. macOS/Linux: `bash scripts/start-local.sh`.

Bản 2.2 thêm thư viện1.217 từ với IPA Mỹ, hình, file nghe từ và câu; luyện chọn nghĩa/nghe/điền từ, lưu từ và ôn theo lịch. Giữ42 bài viết có hướng dẫn và105 lời giải đọc hiểu cụ thể. Bản 2.2 đã có URL/key publishable của dự án được cấp. Cần cài database để dùng tài khoản đồng bộ. Chế độ khách vẫn dùng được để học thử. Không cần tạo tài khoản trước khi học. PWA được kích hoạt trong bản production, không đăng ký service worker khi dùng `next dev`.

## 2. Kết nối Supabase thực sự

**Bản 2.2 đã cấu hình sẵn dự án của bạn.** Xem `docs/KET-NOI-SUPABASE.md`: chạy một file `supabase/LingoStep-Supabase-Setup.sql` trong SQL Editor để tạo bảng và nạp bài học. Không cần service-role key cho cách cài này. Các bước bên dưới là cách cấu hình dự án khác.


1. Tạo một dự án Supabase mới.
2. Mở SQL Editor, chạy **theo thứ tự** `supabase/migrations/202610120001_core.sql`, rồi `202610120002_speech_quota.sql`, `202610120003_cloud_progress.sql` `202610120004_v2_practice_queue.sql` `202610130005_writing.sql` và `202610140006_vocabulary.sql`. Hoặc dùng Supabase CLI và `supabase db push`.
3. Sao chép `.env.example` thành `.env.local`. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` từ trang API settings. Không dùng khóa service role trong biến `NEXT_PUBLIC_`.
4. Điền `SUPABASE_SERVICE_ROLE_KEY` trong môi trường chạy seed trên máy của quản trị viên. Chạy:

```bash
npm run seed
```

5. Trong Authentication → URL Configuration, đặt Site URL là URL triển khai thực tế; thêm URL localhost khi phát triển. Dự án dùng đăng nhập email/mật khẩu; kiểm tra thiết lập xác nhận email và cấu hình SMTP cho môi trường thật.
6. Khởi động lại `npm run dev`. Với bản static/PWA, **build lại sau khi đổi biến `NEXT_PUBLIC_`**:

```bash
npm run build
```

7. Đăng ký hai tài khoản thử; kiểm tra mỗi tài khoản chỉ đọc được tiến độ của chính mình.

Khóa bài và điểm tài khoản do RPC trên PostgreSQL quyết định; trình duyệt không được tự ghi điểm vào `attempts`. Tiến độ khách và tài khoản giữ riêng; không nhập điểm khách thành điểm tài khoản.

Không cần bật exposed schema `private`. Đáp án chuẩn nằm ở schema private; seed qua RPC chỉ cho service role. Đáp án trong JSON client vẫn phục vụ học offline và giải thích, nên đây là công cụ học tập, không phải hệ thống thi cử có chống gian lận.

## 3. Bật chấm phát âm từng âm

1. Tạo Azure Speech resource, lấy **key** và **region**. Đặt chúng trong secrets của Supabase Edge Functions, không đặt vào Next.js public env.
2. Đặt secrets bằng Supabase Dashboard hoặc CLI:

```bash
supabase secrets set AZURE_SPEECH_KEY=YOUR_KEY AZURE_SPEECH_REGION=YOUR_REGION
supabase functions deploy pronunciation
```

3. Giữ JWT verification bật. Đăng nhập ứng dụng, thu câu mẫu, bấm **Gửi bản thu để chấm phát âm**.
4. Kết quả gồm độ chính xác, trôi chảy, độ đầy đủ và điểm từng từ; API cũng trả thông tin phoneme để mở rộng giao diện.

Bản thu được chuyển thành WAV PCM mono 16-bit 16 kHz trước khi gửi. Bản thu chỉ được gửi khi người học bấm nút. Không tự lưu vào Supabase Storage. Giới hạn mặc định 20 lượt/người/ngày UTC, tối đa 30 giây/lượt. Hạn mức vẫn được trừ nếu upstream lỗi sau khi đã nhận yêu cầu; có thể điều chỉnh chính sách trong migration.

Offline: nghe IPA, đọc hướng dẫn, thu, nghe lại, xem sóng âm và chỉ số tương đồng nhịp. **Chưa có mô hình chấm phát âm từng phoneme chạy offline trong bản này.** Việc đánh giá chỉ dựa trên sóng âm không đủ chính xác để thay thế dịch vụ hoặc giáo viên.

## 4. PWA và học offline

```bash
npm run build
```

Thư mục `out/` là bản static production. Triển khai nội dung này qua HTTPS (Vercel, Netlify, Cloudflare Pages, hoặc máy chủ static). Chạy `npm start` để mở bản production tại http://localhost:3000 bằng máy chủ static đi kèm. Không dùng trực tiếp `next start` với `output: 'export'`.

- Chrome/Edge: menu → Cài đặt ứng dụng.
- iPhone/iPad: Safari → Chia sẻ → Thêm vào Màn hình chính.
- Mở app online ít nhất một lần, sau đó vào bài đã mở và bấm **Tải bài offline**. Chỉ báo thành công khi tải đủ nội dung, hình và âm thanh.
- Service worker cache app shell, hình và font; audio được cache khi phát hoặc tải chủ động. Có xử lý byte-range cho phát audio từ cache.
- Thu âm cần HTTPS hoặc localhost và quyền micro. Khả năng hỗ trợ khác nhau giữa các trình duyệt.
- Đồng bộ, đăng nhập và chấm Azure cần mạng. Khi đang đăng nhập và offline, kết quả được giữ trong hàng chờ và gửi khi có mạng. Chỉ mở khóa khi server chấm và xác nhận. Bài đang làm được giữ trên trình duyệt để tiếp tục.
- Bộ nhớ trình duyệt có thể bị dọn khi thiếu dung lượng. Xuất file JSON tiến độ để giữ bản sao. Tiến độ không được cam kết còn sau khi xóa dữ liệu trình duyệt.

## 5. Cấu trúc dự án

| Vị trí | Vai trò |
|---|---|
| `src/app/` | Next.js App Router, layout và CSS responsive |
| `src/components/` | Giao diện, bài học, audio, đọc, quiz, thu âm, IPA |
| `src/data/curriculum.json` | Nội dung bài, từ, bài đọc, câu hỏi và timestamps |
| `src/data/ipa.json` | 41 âm/biến thể giọng Mỹ, khẩu hình và từ mẫu |
| `src/data/glossary.json` | Nghĩa từ theo bài đọc |
| `src/lib/engine.ts` | Khóa bài, chấm local, tạo đề cột mốc, lịch ôn |
| `src/lib/supabase.ts` | Client Supabase có Auth và session |
| `supabase/migrations/` | Bảng, RLS, RPC chấm bài, giới hạn dùng dịch vụ |
| `supabase/functions/pronunciation/` | Adapter Azure Speech, xác thực, kiểm tra WAV |
| `scripts/seed.ts` | Nạp đáp án chuẩn và lộ trình qua quyền quản trị |
| `scripts/postbuild.mjs` | Tạo service worker theo hash bản build |
| `public/` | Hình, file nghe, font và icon PWA cục bộ |
| `tests/` | Kiểm thử nội dung, thuật toán và quyền PostgreSQL |
| `docs/` | Phân tích thiết kế, cách mở rộng, nguồn tài nguyên |

## 6. Thêm nội dung

Thêm bài vào `curriculum.json` với một quy tắc, từ có IPA/hình/audio/ngữ cảnh, một reader, hai câu ngữ pháp và câu nghe. Sau đó kiểm tra nhóm bài 6 bài/chặng và chỉnh thuật toán nếu muốn số lượng khác. Đáp án/giải thích từng câu phải do người biên soạn kiểm tra.

Timestamps của bài đọc được tạo từ alignment phoneme của giọng tổng hợp, đối chiếu với chuỗi từ. Thay file audio phải thay cả timestamps. Không lấy timestamps của file tổng hợp gán cho bản thu người thật.

`generate_audio.py` là công cụ tạo file ở thời điểm biên soạn, **không phải phụ thuộc runtime**. Muốn tái tạo file: cài Python, ffmpeg, `pip install 'piper-tts[alignment]' numpy`, tải `en_US-ljspeech-medium.onnx` và file `.onnx.json`, chạy:

```bash
python scripts/generate_audio.py /path/to/en_US-ljspeech-medium.onnx
```

Bản app đã kèm file nghe, không cần tải model để sử dụng. File bản ngữ được ghi nguồn, tác giả, giấy phép và thông tin chuyển OGG→MP3 trong `docs/audio-credits.json`. Font Be Vietnam Pro dùng SIL OFL; hình hero được tạo cho dự án, SVG do dự án biên soạn.

## 7. Kiểm thử

```bash
npm run typecheck
npm test
npm run build
```

Test PostgreSQL dùng PGlite chạy migration thực, với hai tài khoản mô phỏng để kiểm tra RLS, quyền ghi điểm, khóa bài, seed và phiên kiểm tra. Không cần Supabase thật để chạy nhóm test này. Kiểm thử Azure/live Supabase và tương tác trình duyệt phải thực hiện sau khi có dịch vụ được cấu hình.
