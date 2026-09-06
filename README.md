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
│   ├── assets/hairs/              # Bộ tóc PNG trong suốt (AI vẽ) + manifest.json
│   ├── assets/models/             # Mô hình tóc 3D .glb cho gương AR
│   └── tools/                     # Kiểm tra tĩnh + sinh tóc dự phòng (OpenCV)
├── ai-runtime/                    # 🪄 AI sinh tóc local (SD-Turbo trên GPU)
│   ├── hair_service.py            # FastAPI cổng 8010: text -> ảnh tóc -> PNG
│   ├── generate_hair_library.py   # Sinh lại cả bộ 8 kiểu tóc chuẩn
│   └── Python312/                 # Python 3.12 + PyTorch CUDA (đã gitignore)
└── Text-To-Image-Generator/       # Dự án con có git riêng (ai-core đã sửa sang SD-Turbo)
```

## 🪄 AI Sinh Tóc Từ Chữ (chạy GPU local)

Salon có **máy sinh kiểu tóc riêng** (text-to-image bằng Stable Diffusion Turbo) chạy
ngay trên GPU NVIDIA của máy (RTX 3050 4GB là đủ), không cần API cloud:

```powershell
# Chạy 1 lần: cài bộ máy AI (Python 3.12 + PyTorch CUDA + diffusers, ~7GB)
# Đã có sẵn Python 3.12 trong ai-runtime/Python312 — chỉ cần:
cd ai-runtime\Python312
.\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
.\python.exe -m pip install diffusers transformers accelerate safetensors pillow fastapi uvicorn opencv-python-headless

# Chạy dịch vụ sinh tóc (cổng 8010)
.\python.exe ..\hair_service.py
```

- Trong web: **AI Studio** → hộp **"🪄 AI Sinh Tóc Theo Ý Bạn"** — gõ mô tả kiểu tóc,
  AI vẽ mẫu trong 2-5 giây và đội ngay lên ảnh khách.
- Sinh lại **toàn bộ 8 kiểu tóc chuẩn** (xoá bộ cũ, thay mới): `.\python.exe ..\generate_hair_library.py`
- 📘 Xem giáo trình đầy đủ trong [HUAN-LUYEN-AI.md](HUAN-LUYEN-AI.md).

## 🔧 Ghi chú kỹ thuật

- MediaPipe Tasks Vision được **pin version `1.0.1`** — các bản `0.10.x` cũ đã bị gỡ
  `vision_bundle.js` khỏi CDN; engine còn tự chèn script từ CDN dự phòng nếu script chính lỗi.
- FaceLandmarker khởi tạo ở chế độ `VIDEO`; ảnh tĩnh phải dò bằng `detectForVideo()` với
  timestamp tăng dần (không dùng `detect()` kiểu IMAGE).
- Ảnh tóc 2D chuẩn 600×600 với mốc chân tóc tại **52% chiều cao** để neo đúng landmark 10
  (đỉnh trán). Sinh lại bằng `python tools/generate_hair_assets.py`.
