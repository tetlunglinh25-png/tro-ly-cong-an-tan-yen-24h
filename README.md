# Trợ lý Công an Tân Yên 24H - Bản Google Gemini API tiết kiệm chi phí

Bản này dùng Google Gemini API thay cho OpenAI API.

Điểm khác biệt quan trọng:

- Không dùng Vector Store trả phí.
- Không upload tài liệu công khai.
- Tài liệu được xử lý trước thành `data/knowledge.json`.
- Mỗi câu hỏi, hệ thống tìm trong `knowledge.json` trước.
- Nếu không tìm thấy dữ liệu phù hợp, hệ thống trả lời mẫu liên hệ Công an xã và **không gọi Gemini**, giúp tiết kiệm chi phí.
- Nếu tìm thấy dữ liệu, hệ thống chỉ gửi vài đoạn liên quan nhất lên Gemini để trả lời ngắn gọn.

## 1. Cấu trúc

```text
.
├─ index.html
├─ api/
│  ├─ chat.js
│  └─ public-config.js
├─ scripts/
│  └─ build-knowledge.js
├─ docs/
│  └─ README.txt
├─ data/
│  └─ knowledge.json
├─ package.json
├─ vercel.json
├─ .env.example
└─ .gitignore
```

## 2. Lấy Google Gemini API key

Vào:

```text
https://aistudio.google.com/app/apikey
```

Tạo API key mới.

Google hướng dẫn API key Gemini được tạo/quản lý trong Google AI Studio và có thể đặt vào biến môi trường `GEMINI_API_KEY`.

## 3. Tạo file .env

Copy `.env.example` thành `.env`.

Điền:

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite

BOT_NAME=Trợ lý Công an Tân Yên 24H
UNIT_NAME=Công an xã Tân Yên, Bắc Ninh
HOTLINE=0240.3878.666
FANPAGE_URL=https://www.facebook.com/

MIN_SEARCH_SCORE=2.2
MAX_CONTEXT_CHUNKS=4
MAX_CHUNK_CHARS=950
```

## 4. Cài thư viện

```bash
npm install
```

## 5. Nạp tài liệu

Copy tài liệu vào thư mục `docs`.

Nên dùng:

- `.docx`
- `.txt`
- `.md`
- `.pdf` có chữ thật

Không nên dùng PDF scan ảnh.

Sau đó chạy:

```bash
npm run build-knowledge
```

Lệnh này tạo file:

```text
data/knowledge.json
```

Phải commit file `data/knowledge.json` lên GitHub để Vercel dùng được.

## 6. Chạy thử

```bash
npm install -g vercel
npm run dev
```

## 7. Deploy Vercel

1. Đưa mã lên GitHub.
2. Vào Vercel → Add New Project.
3. Import repo GitHub.
4. Thêm Environment Variables:

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite
BOT_NAME=Trợ lý Công an Tân Yên 24H
UNIT_NAME=Công an xã Tân Yên, Bắc Ninh
HOTLINE=0240.3878.666
FANPAGE_URL=https://www.facebook.com/link-fanpage-that
MIN_SEARCH_SCORE=2.2
MAX_CONTEXT_CHUNKS=4
MAX_CHUNK_CHARS=950
```

5. Deploy.

## 8. Cập nhật tài liệu sau này

Khi có tài liệu mới:

1. Copy file vào `docs`.
2. Chạy:

```bash
npm run build-knowledge
```

3. Commit file `data/knowledge.json` mới lên GitHub.
4. Vercel tự deploy lại hoặc bấm Redeploy.

## 9. Điều chỉnh chi phí

Các biến tiết kiệm chi phí:

```env
MIN_SEARCH_SCORE=2.2
MAX_CONTEXT_CHUNKS=4
MAX_CHUNK_CHARS=950
```

Gợi ý:

- Muốn tiết kiệm hơn: tăng `MIN_SEARCH_SCORE` lên `3.0`, giảm `MAX_CONTEXT_CHUNKS` xuống `3`.
- Muốn trả lời rộng hơn: giảm `MIN_SEARCH_SCORE` xuống `1.8`.
- Muốn câu trả lời chi tiết hơn: tăng `MAX_CHUNK_CHARS` lên `1300`.

## 10. Thay logo

Thêm vào thư mục gốc:

```text
logo-cong-an.png
logo-doan.png
```

Nếu không có logo, giao diện sẽ dùng icon thay thế.

## 11. Lưu ý bảo mật

- Không đưa file `.env` lên GitHub.
- Không dán Gemini API key vào `index.html`.
- Không cho người dân upload tài liệu công khai.
- Không yêu cầu người dân nhập CCCD, số điện thoại, địa chỉ cụ thể.


## 12. Tự động sinh câu hỏi gợi ý thông minh

Bản này đã bổ sung tính năng tự động tạo câu hỏi gợi ý sau mỗi câu trả lời.

Cơ chế hoạt động:

```text
1. Người dân đặt câu hỏi
2. Hệ thống tìm trong data/knowledge.json
3. Nếu không có dữ liệu phù hợp:
   - Không gọi Gemini
   - Trả lời mẫu liên hệ Công an xã
   - Hiển thị vài câu hỏi gợi ý chung
4. Nếu có dữ liệu phù hợp:
   - Gửi các đoạn dữ liệu liên quan lên Gemini để trả lời
   - Sau đó sinh 4-5 câu hỏi gợi ý dựa trên chính dữ liệu và câu trả lời
   - Giao diện hiển thị thành các nút bấm
```

Các câu hỏi gợi ý ưu tiên theo hướng:

- Thành phần hồ sơ
- Trình tự thực hiện
- Thời hạn giải quyết
- Cơ quan tiếp nhận/thực hiện
- Mục đích của thủ tục
- Lưu ý khi thực hiện

Lưu ý chi phí:

- Tính năng gợi ý thông minh có thêm một lần gọi Gemini ngắn sau khi có câu trả lời.
- Nếu muốn tiết kiệm tối đa, có thể tắt phần gọi Gemini sinh gợi ý và chỉ dùng `defaultSuggestions()` trong `api/chat.js`.


## 13. Câu hỏi gợi ý tại trang chủ

Trang chủ đã có sẵn các nút câu hỏi gợi ý:

```text
Hướng dẫn cài đặt định danh mức hai
Hướng dẫn cài đặt chữ ký số trên VNeID
Hướng dẫn đăng ký thường trú
Hướng dẫn đăng ký tạm trú
Hướng dẫn xác nhận thông tin cư trú
Hướng dẫn khai báo lưu trú
Tôi cần liên hệ Công an xã Tân Yên bằng cách nào?
```

Muốn sửa các câu hỏi này, mở file `index.html`, tìm đoạn:

```html
<div class="quick">
```

Sau đó sửa nội dung trong các nút:

```html
<button onclick="askQuick('Nội dung câu hỏi')">Nội dung hiển thị</button>
```

Ví dụ:

```html
<button onclick="askQuick('Hướng dẫn cài đặt định danh mức hai')">Hướng dẫn cài đặt định danh mức hai</button>
```

## 14. Yêu cầu tài liệu tương ứng

Để trợ lý trả lời được các câu hỏi gợi ý trên, trong thư mục `docs` nên có tài liệu chứa nội dung rõ ràng như:

```text
Tên nội dung: Hướng dẫn cài đặt định danh mức hai
Mục đích để làm gì:
Đối tượng thực hiện:
Điều kiện thực hiện:
Các bước thực hiện:
Bước 1:
Bước 2:
Bước 3:
Lưu ý:
```

Tương tự với:

```text
Hướng dẫn cài đặt chữ ký số trên VNeID
Hướng dẫn đăng ký thường trú
Hướng dẫn đăng ký tạm trú
Hướng dẫn xác nhận thông tin cư trú
Hướng dẫn khai báo lưu trú
```

Sau khi thêm hoặc sửa tài liệu, chạy lại:

```bash
npm run build-knowledge
```

Sau đó commit file `data/knowledge.json` mới lên GitHub và redeploy trên Vercel.
