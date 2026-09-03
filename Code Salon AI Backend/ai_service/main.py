from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import shutil
from pathlib import Path
from uuid import uuid4

try:
    from .face_logic import analyze_face_metrics
except ImportError:  # Allows `uvicorn main:app` from the ai_service folder.
    from face_logic import analyze_face_metrics

app = FastAPI(title='Hana Hair AI Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

UPLOAD_DIR = Path(__file__).resolve().parent / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)


class Base64ImageRequest(BaseModel):
    imageBase64: str
    filename: str = 'upload.jpg'


def safe_upload_path(filename: str) -> Path:
    """Create a private, collision-free path for a temporary upload."""
    safe_name = Path(filename or 'upload.jpg').name
    suffix = Path(safe_name).suffix.lower()
    if suffix not in {'.jpg', '.jpeg', '.png', '.webp'}:
        suffix = '.jpg'
    return UPLOAD_DIR / f'{uuid4().hex}{suffix}'


def decode_base64_image(value: str) -> bytes:
    """Decode raw base64 and browser data-URL image values."""
    encoded = value.split(',', 1)[1] if value.startswith('data:') and ',' in value else value
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail='Dữ liệu base64 không hợp lệ') from exc


@app.get('/health')
def health():
    return {'success': True, 'message': 'AI service đang hoạt động'}


@app.post('/analyze-face')
async def analyze_face(file: UploadFile | None = None, payload: Base64ImageRequest | None = None):
    if payload is not None:
        raw = decode_base64_image(payload.imageBase64)
        file_path = safe_upload_path(payload.filename)
        try:
            file_path.write_bytes(raw)
            result = analyze_face_metrics(file_path)
        finally:
            file_path.unlink(missing_ok=True)
        return {
            'success': True,
            'data': {
                'source_file': Path(payload.filename).name,
                'face_shape': result['face_shape'],
                'confidence': result['confidence'],
                'metrics': result['metrics'],
                'landmarks': result.get('landmarks', {}),
                'overlay': result.get('overlay', {}),
                'recommendation': result['recommendation'],
            }
        }

    if file is None:
        raise HTTPException(status_code=400, detail='Thiếu ảnh đầu vào.')

    file_path = safe_upload_path(file.filename or 'upload.jpg')
    try:
        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
        result = analyze_face_metrics(file_path)
    finally:
        file_path.unlink(missing_ok=True)
    return {
        'success': True,
        'data': {
            'source_file': Path(file.filename or 'upload.jpg').name,
            'face_shape': result['face_shape'],
            'confidence': result['confidence'],
            'metrics': result['metrics'],
            'landmarks': result.get('landmarks', {}),
            'overlay': result.get('overlay', {}),
            'recommendation': result['recommendation'],
        }
    }
