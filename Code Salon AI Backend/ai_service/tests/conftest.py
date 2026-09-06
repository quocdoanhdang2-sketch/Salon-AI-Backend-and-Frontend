"""Đưa thư mục gốc Backend vào sys.path để import được package `ai_service`
bất kể pytest được chạy từ thư mục nào (ai_service/, Backend/ hay gốc repo)."""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
