# Hana Hair AI Service

Service Python cho phân tích khuôn mặt và đề xuất kiểu tóc phù hợp.

## Cách chạy

1. Tạo môi trường ảo
   python -m venv .venv
   .venv\Scripts\activate

2. Cài package
   pip install -r requirements.txt

3. Chạy server
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload

4. Test health check
   http://localhost:8001/health

## API

### POST /analyze-face
Nhận file ảnh và trả về dạng mặt + khuyến nghị tóc.
