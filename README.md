# 💈 HANA HAIR SALON — Hệ Thống Quản Lý Salon Tóc Tích Hợp AI

Monorepo gồm **Backend Node.js (Express + SQLite)**, **AI Service Python (FastAPI + OpenCV)** và
**Frontend thuần HTML/CSS/JS** với Gương Soi 3D AR Real-Time (MediaPipe 478 Landmark + Three.js WebGL).

## ✨ Tính năng chính

- **Gương Soi 3D AR Real-Time**: bật camera, MediaPipe dò 478 landmark khuôn mặt, đội mô hình tóc 3D
  (`.glb`) theo chuyển động đầu (xoay/nghiêng/gật), kèm occlusion mesh che tóc đâm xuyên mặt.
- **Chụp Ảnh Gương 3D**: gộp khung hình webcam (đã lật gương) + tóc 3D + màu nhuộm đang thử thành
  một ảnh JPEG tải về được; nếu tóc 3D chưa kịp hiển thị, engine tự ghép tóc 2D theo landmark.
- **AI Studio 2D (ảnh tĩnh)**: tải/chụp ảnh → phân tích dáng mặt + tone da → ghép 8 kiểu tóc PNG
  trong suốt (`assets/hairs/`) → nhuộm màu multiply → so sánh Before/After/Split.
- **Ghép tóc AI Cloud (HairFastGAN)**: endpoint `/api/ai/try-on-real` gọi Replicate với ảnh tham
  chiếu tóc thật, trả kết quả dataURL an toàn cho canvas (cần `REPLICATE_API_TOKEN` trong `.env`).
- **Chatbot Hana AI**: `/api/ai/chat` gọi Gemini (chuỗi fallback `gemini-3.6-flash` → `3.8-flash` →
  `3.1-flash-lite`), trả JSON kèm action mở form đặt lịch.
- **Đặt lịch & Phân quyền**: khách hàng / thợ stylist / admin, JWT, tích điểm hạng thành viên,
  thống kê doanh thu, lưu SQLite.

## 🚀 Chạy dự án

### 1. Backend chính (cổng 3000 & 8080)

```bash
cd "Code Salon AI Backend"
npm install
npm start          # hoặc node server.js
```

Cấu hình qua `.env` (xem `.env.example`): `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`REPLICATE_API_TOKEN`, `AI_SERVICE_URL`.

### 2. AI Service Python (cổng 8001 — dùng cho phân tích ảnh tĩnh)

```bash
cd "Code Salon AI Backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r ai_service/requirements.txt
uvicorn main:app --app-dir ai_service --port 8001
```

Chạy bộ test:

```bash
.venv\Scripts\python -m pytest ai_service/tests -v
```

### 3. Truy cập

Mở `http://localhost:3000` (hoặc `8080`). Tài khoản mẫu: `admin/admin123`,
`stylist_alex/12345678`, `0988123456/12345678`.

## 🧩 Kiến trúc thư mục

```
├── Code Salon AI Backend/         # Express API + JWT + SQLite + proxy AI
│   ├── server.js                  # /api/auth, /api/bookings, /api/ai/*
│   ├── ai_service/                # FastAPI: phân tích dáng mặt & tone da (OpenCV)
│   └── .env.example
├── Code Salon AI Frontend/        # Giao diện salon
│   ├── index.html                 # Trang chính (gương 3D + AI Studio + đặt lịch)
│   ├── dich-vu.html               # Trang dịch vụ (cùng engine try-on)
│   ├── cv-hair-engine.js          # Engine MediaPipe + Three.js + ghép tóc 2D
│   ├── script.js                  # Tương tác UI, camera, chụp ảnh, chatbot
│   ├── assets/hairs/              # 8 kiểu tóc PNG trong suốt cho try-on 2D
│   ├── assets/models/             # Mô hình tóc 3D .glb cho gương AR
│   └── tools/generate_hair_assets.py  # Sinh lại bộ ảnh tóc (OpenCV)
└── Text-To-Image-Generator/       # Dự án con có git riêng (không track ở đây)
```

## 🔧 Ghi chú kỹ thuật

- MediaPipe Tasks Vision được **pin version `1.0.1`** — các bản `0.10.x` cũ đã bị gỡ
  `vision_bundle.js` khỏi CDN; engine còn tự chèn script từ CDN dự phòng nếu script chính lỗi.
- FaceLandmarker khởi tạo ở chế độ `VIDEO`; ảnh tĩnh phải dò bằng `detectForVideo()` với
  timestamp tăng dần (không dùng `detect()` kiểu IMAGE).
- Ảnh tóc 2D chuẩn 600×600 với mốc chân tóc tại **52% chiều cao** để neo đúng landmark 10
  (đỉnh trán). Sinh lại bằng `python tools/generate_hair_assets.py`.
