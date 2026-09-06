"""
============================================================================
SINH CẢ BỘ 8 KIỂU TÓC SALON CHUẨN BẰNG STABLE DIFFUSION (chạy trên GPU local)
============================================================================
Xoá bộ tóc cũ và thay bằng ảnh tóc thật do AI tinh chỉnh: hình dạng lấy từ
silhouette chuẩn của salon (đúng mốc chân tóc, có lỗ mở mặt), chất liệu sợi
tóc do SD 1.5 img2img vẽ lại — mặt người mẫu không thể xuất hiện. Seed cố
định để chạy lại ra đúng bộ cũ (tái lập được).

Chạy:  Python312/python.exe generate_hair_library.py   (từ thư mục ai-runtime)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hair_service import (  # noqa: E402
    HAIRS_DIR,
    MANIFEST_PATH,
    build_hair_asset_from_silhouette,
    save_asset,
)

# 8 kiểu tóc chuẩn menu salon: (key, tên hiển thị, prompt chất liệu tiếng Anh)
STYLES = [
    ("layer_nu", "Layer Dài Cúp Ngọn Hàn Quốc",
     "korean long layered dark brown haircut, feathered layer tips, thin see-through curtain bangs"),
    ("wave_nu", "Sóng Lơi Bồng Bềnh Hàn Quốc",
     "long chestnut brown loose waves, bouncy soft curls flowing past shoulders"),
    ("bob_nu", "Bob Ngắn Cá Tính Balayage",
     "short dark bob haircut with subtle inward curled ends and wispy bangs, caramel balayage highlights"),
    ("wolf_cut", "Wolf Cut / Shag Thời Thượng",
     "dark brown wolf cut shag, choppy layered texture with wispy fringe, messy volume"),
    ("straight_silk", "Thẳng Suôn Keratin Bóng Mượt",
     "long glossy jet black silky straight hair, middle part, mirror shine"),
    ("pixie_nu", "Pixie Cut Hiện Đại Nữ",
     "ash brown pixie cut, short textured layers with side swept fringe"),
    ("layer_nam", "Layer Nam Textured Crop",
     "korean men black brown textured crop, tousled short layers with natural fringe"),
    ("sidepart_nam", "Side Part 7/3 Lịch Lãm Nam",
     "men dark brown classic side part, slick voluminous top combed to one side, clean part line"),
]


def main():
    print("=" * 70)
    print("SINH BỘ TÓC SALON — silhouette chuẩn + SD 1.5 img2img (GPU local)")
    print("=" * 70)

    # Xoá sạch bộ tóc cũ (kèm preview sheet) — "làm sạch rồi thay mới"
    HAIRS_DIR.mkdir(parents=True, exist_ok=True)
    removed = 0
    for old in HAIRS_DIR.glob("*.png"):
        old.unlink()
        removed += 1
    for junk in HAIRS_DIR.glob("_preview_sheet*"):
        junk.unlink()
    if MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()
    print(f"Đã làm sạch {removed} file tóc cũ.")

    total_ms = 0
    ok_count = 0
    for key, label, desc in STYLES:
        started = time.time()
        print(f"\n→ [{key}] {label}")
        try:
            seed = abs(hash(key)) % (2 ** 31)
            rgba, meta = build_hair_asset_from_silhouette(desc, key, seed)
            saved = save_asset(rgba, key, label, meta, desc)
            ms = int((time.time() - started) * 1000)
            total_ms += ms
            ok_count += 1
            print(f"  [OK] {saved['file']}  hairline@{saved['anchorY']}  ({ms} ms)")
        except Exception as exc:
            print(f"  [LỖI] {exc}")

    print(f"\nHoàn tất {ok_count}/{len(STYLES)} kiểu trong {total_ms / 1000:.1f}s tại {HAIRS_DIR}")


if __name__ == "__main__":
    main()
