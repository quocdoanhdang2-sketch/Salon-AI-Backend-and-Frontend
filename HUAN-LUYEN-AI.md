# 📘 HUẤN LUYỆN AI — Giáo Trình Toàn Tập cho HANA HAIR SALON

> Tài liệu này dạy bạn **hiểu - chạy - dùng - mở rộng** toàn bộ hệ thống AI của salon:
> từ nhận diện khuôn mặt, ghép tóc 3D/2D, cho đến **sinh kiểu tóc mới từ chữ (text-to-image)**
> chạy ngay trên GPU NVIDIA của máy salon. Viết cho người không cần biết lập trình sâu.

---

## MỤC LỤC

1. [Tổng quan: AI trong salon của bạn có gì](#1-tổng-quan)
2. [Phần cứng & phần mềm cần có](#2-phần-cứng--phần-mềm)
3. [Cài đặt "bộ não AI" (Python 3.12 + PyTorch CUDA + Stable Diffusion)](#3-cài-đặt-bộ-não-ai)
4. [Khởi động các dịch vụ AI theo đúng thứ tự](#4-khởi-động-dịch-vụ)
5. [Sinh kiểu tóc từ mô tả chữ (text-to-image) — cách dùng](#5-sinh-tóc-từ-chữ)
6. ["Huấn luyện" lại bộ tóc chuẩn của salon](#6-huấn-luyện-lại-bộ-tóc-chuẩn)
7. [Nghệ thuật viết prompt tóc đẹp (bí kíp)](#7-nghệ-thuật-viết-prompt)
8. [Nâng cấp nghiêm túc: fine-tune model theo tóc salon bạn (LoRA)](#8-fine-tune-lora)
9. [Cách hệ thống ghép tóc lên mặt thật hoạt động (kiến trúc)](#9-kiến-trúc-hệ-thống)
10. [Bảng lỗi thường gặp & cách chữa](#10-sửa-lỗi)

---

## 1. Tổng quan

Hệ thống AI của salon có **4 khối**:

| Khối | Chạy ở đâu | Việc gì |
|---|---|---|
| **MediaPipe 478 Landmark** | Trình duyệt khách (GPU WebGL) | Dò 478 điểm khuôn mặt real-time từ webcam |
| **Gương Soi 3D AR** | Trình duyệt (Three.js WebGL) | Đội mô hình tóc `.glb` lên đầu thật, xoay theo đầu |
| **AI Studio 2D** | Trình duyệt + Backend | Ghép ảnh tóc thật lên ảnh khách, nhuộm màu, so sánh trước/sau |
| **AI Sinh Tóc (Stable Diffusion 1.5)** | GPU máy salon (`ai-runtime/`, cổng 8010) | Mô tả kiểu tóc bằng chữ → AI **vẽ mẫu tóc thật** trong 5-10 giây|

Luồng sử dụng cho khách hàng: mở trang → bật **Gương Soi 3D** thử tóc trực tiếp →
bấm **Chụp Ảnh Gương 3D** để lưu ảnh → vào **AI Studio** ghép tóc 2D chân thực,
nhuộm màu, hoặc gõ chữ **"AI Sinh Tóc Theo Ý Bạn"** để thợ vẽ mẫu riêng cho khách.

## 2. Phần cứng & phần mềm

- **GPU NVIDIA tối thiểu 4GB VRAM** (salon đang dùng: GeForce RTX 3050 4GB Laptop — đủ).
  Kiểm tra: mở PowerShell gõ `nvidia-smi`, thấy tên card là được.
- Dung lượng trống ~**8GB** cho phần mềm AI + model.
- **Python 3.12** (bản embeddable đã được cài sẵn trong `ai-runtime/Python312/` của dự án).
- Node.js 18+ cho backend chính (đang dùng v24).

> ⚠️ Tại sao phải Python 3.12 chứ không 3.14? Vì thư viện PyTorch (phần cốt lõi chạy GPU)
> **chưa phát hành bản chính thức cho Python 3.14**. Đây là lý do dự án kèm sẵn
> Python 3.12 riêng trong `ai-runtime/Python312/` — không đụng vào Python hệ thống.

## 3. Cài đặt bộ não AI

Chỉ cần làm **1 lần**. Mở PowerShell tại thư mục gốc dự án:

```powershell
cd ai-runtime\Python312
# 1) Cài PyTorch bản CUDA (tải ~2.5GB)
.\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
# 2) Cài các thư viện sinh ảnh (~500MB)
.\python.exe -m pip install diffusers transformers accelerate safetensors pillow fastapi uvicorn
```

Lần đầu chạy dịch vụ, model Stable Diffusion 1.5 (~2GB) sẽ **tự động tải từ HuggingFace**
về máy và lưu cache ở `%USERPROFILE%\.cache\huggingface\` — các lần sau không tải lại.

**Kiểm tra GPU nhận được chưa:**

```powershell
.\python.exe -c "import torch; print(torch.cuda.get_device_name(0))"
# Kết quả mong đợi: NVIDIA GeForce RTX 3050 ...
```

## 4. Khởi động dịch vụ

Mở **3 cửa sổ PowerShell** tại thư mục gốc dự án:

```powershell
# Cửa sổ 1 — Backend chính (trang web + API, cổng 3000)
cd "Code Salon AI Backend"
npm start

# Cửa sổ 2 — AI phân tích khuôn mặt (OpenCV, cổng 8001) — tùy chọn, cho AI Studio 2D
cd "Code Salon AI Backend"
.venv\Scripts\activate
uvicorn main:app --app-dir ai_service --port 8001

# Cửa sổ 3 — AI SINH TÓC từ chữ (GPU, cổng 8010) — dùng cho nút "SINH TÓC MỚI"
cd ai-runtime\Python312
.\python.exe ..\hair_service.py
```

Mở `http://localhost:3000` — phần **GƯƠNG SOI 3D AR REAL-TIME**.
Kiểm tra AI sinh tóc sống chưa: `http://localhost:3000/api/ai/hair-gen-status`.

## 5. Sinh tóc từ chữ

Trong trang web: **Chụp / Tải Ảnh & AI Studio 4K** → bước 3 *Thử Tóc & Tinh Chỉnh* →
hộp **"🪄 AI SINH TÓC THEO Ý BẠN"**:

1. Gõ mô tả kiểu tóc, ví dụ: `tóc xoăn sóng dài ngang lưng nhuộm nâu caramel`.
2. Bấm **SINH TÓC MỚI**.
3. Khoảng 5-10 giây (lần đầu 20-40 giây do nạp model), mẫu tóc xuất hiện ngay trong
   bộ sưu tập và **tự động đội lên ảnh khách** — nhuộm lại màu, tinh chỉnh, chụp ảnh như thường.

Gọi trực tiếp API (cho thợ lập trình/CRM):

```bash
curl -X POST http://localhost:3000/api/ai/generate-hair ^
  -H "Content-Type: application/json" ^
  -d "{\"prompt\":\"bob ngắn uốn cụp đuôi nhuộm bạch kim\", \"label\":\"Bob Bach Kim\"}"
```

## 6. "Huấn luyện" lại bộ tóc chuẩn

Bộ 8 kiểu tóc mặc định trong menu salon là ảnh **AI vẽ sẵn** (Stable Diffusion 1.5 chạy trên máy,
seed cố định nên chạy lại ra đúng bộ cũ). Muốn **làm sạch và thay bộ mới**:

```powershell
cd ai-runtime\Python312
.\python.exe ..\generate_hair_library.py
```

Script sẽ: xoá toàn bộ PNG cũ trong `Code Salon AI Frontend/assets/hairs/` →
sinh lại 8 kiểu với prompt chuẩn salon → ghi `manifest.json` (chứa mốc chân tóc
của từng kiểu để đội lên mặt luôn đúng vị trí).

## 7. Nghệ thuật viết prompt

Công thức sinh tóc đẹp: **[kiểu cắt] + [độ dài] + [chất tóc/màu] + (tùy chọn) [mái]**

| Muốn vậy | Gõ prompt |
|---|---|
| Layer Hàn Quốc | `tóc layer dài hàn quốc cúp ngọn mái bay` |
| Sóng lơi bồng bềnh | `tóc uốn sóng lơi bồng bềnh dài qua vai nâu socola` |
| Bob cá tính | `tóc bob ngắn cụp đuôi balayage nâu caramel` |
| Nam lịch lãm | `tóc nam side part 7/3 vuốt phồng lịch lãm` |
| Màu lạ | `tóc dài thẳng nhuộm xám khói ombre bạch kim` |

Nguyên tắc: **càng cụ thể càng đẹp** — nêu độ dài (ngang vai/ngang lưng), màu (nâu hạt dẻ,
bạch kim...), mái (mái bay/mái thưa/rẽ ngôi giữa). Prompt quá ngắn (<6 ký tự) hệ thống từ chối.

## 8. Fine-tune LoRA (nâng cao)

Khi muốn AI **"học thuộc" chính phong cách tóc của salon** (ví dụ kỹ thuật uốn riêng):
chụp ~20-30 ảnh tác phẩm của salon (cùng chủ đề, nền sạch), rồi dùng
[kohya_ss](https://github.com/bmaltais/kohya_ss) train một **LoRA** nhỏ (rank 8-16,
~30 phút trên RTX 3050). Đưa LoRA vào pipeline chỉ cần thêm trong
`ai-runtime/hair_service.py`:

```python
pipe.load_lora_weights("duong_dan/thu_muc_lora")   # sau khi nạp pipe
```

Sinh ảnh kèm token đặc biệt đã train, ví dụ: `hana_salon_style korean layer cut wig...`.
Đây chính là hình thức "huấn luyện" nhẹ nhất có thể chạy trên card 4GB.

## 9. Kiến trúc hệ thống

```
 ┌────────────── Trình duyệt khách ──────────────┐
 │  MediaPipe FaceLandmarker (478 điểm, WebGL)   │
 │  ├─ Gương 3D: Three.js đội tóc .glb theo đầu  │
 │  └─ Studio 2D: canvas ghép ảnh tóc + nhuộm    │
 └───────────────┬───────────────────────────────┘
                 │ http://localhost:3000
 ┌───────────────▼───────────────────────────────┐
 │  Node.js Backend (Express) — server.js        │
 │  /api/ai/generate-hair → proxy sang Python    │
 │  /api/ai/chat → Gemini 3.6 Flash (fallback)   │
 │  /api/ai/try-on-real → Replicate HairFastGAN  │
 └───────┬───────────────────────┬───────────────┘
         │ :8010                 │ :8001
 ┌───────▼──────────────┐ ┌──────▼────────────────┐
 │ ai-runtime (Py3.12)  │ │ ai_service (Py3.14)   │
 │ SD 1.5 trên GPU       │ │ OpenCV đo dáng mặt,   │
 │ sinh tóc từ chữ,     │ │ tone da (Haar cascade)│
 │ cắt nền → PNG+manifest│ └───────────────────────┘
 └──────────────────────┘
```

Điểm mấu chốt của ghép tóc 2D đúng vị trí: ảnh tóc chuẩn 600×600, và file
`manifest.json` ghi **anchorY** — tỉ lệ "đường chân tóc" trong ảnh. Khi ghép,
engine lấy landmark số 10 (đỉnh trán) của MediaPipe làm điểm tựa, kéo ảnh tóc
rộng 2.5 lần bề ngang mặt, xoay theo góc nghiêng đầu → tóc ôm đúng trán khách.

## 10. Sửa lỗi

| Hiện tượng | Nguyên nhân | Cách chữa |
|---|---|---|
| "Chưa kết nối được dịch vụ AI sinh tóc local" | Cửa sổ 3 chưa chạy | Chạy `.\python.exe ..\hair_service.py` trong `ai-runtime\Python312` |
| `torch.cuda.is_available() = False` | Cài nhầm torch CPU hoặc driver cũ | Cài lại theo mục 3 (index-url cu124), cập nhật driver NVIDIA |
| Lần đầu sinh tóc rất lâu | Đang tải model 2.5GB từ HuggingFace | Chờ 5-10 phút lần đầu; các lần sau vài giây |
| Hết VRAM (OOM) | Đang chạy nhiều app dùng GPU | Đóng game/app AI khác; giảm `steps` về 1-2 |
| Badge gương 3D báo "không tải được thư viện AI" | Mạng chặn CDN jsdelivr/unpkg | Kiểm tra mạng; engine tự chuyển CDN dự phòng |
| Ảnh tóc sinh ra bị lỗi nền | Prompt khó (tóc sau đầu...) | Bấm sinh lại (seed khác), thêm từ "white background, studio photo" |

---

*Biên soạn kèm phiên bản hệ thống: tháng 9/2026 — AI runtime Stable Diffusion 1.5 local @ RTX 3050 4GB.*
