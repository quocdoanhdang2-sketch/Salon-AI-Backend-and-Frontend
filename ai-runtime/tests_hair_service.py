"""
Test bộ xử lý ảnh tóc của ai-runtime (không cần GPU — chỉ test hàm thuần).
Chạy:  ai-runtime/Python312/python.exe -m pytest tests_hair_service.py -v
"""
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hair_service import (  # noqa: E402
    ASSET_SIZE,
    cutout_white_background,
    find_hairline_ratio,
    image_contains_face,
    normalize_asset,
    slugify,
)


def _synthetic_wig(size=600, hole_open_at_bottom=False):
    """Ảnh mô phỏng tóc: khối tóc đặc + vùng mở mặt ở giữa.
    hole_open_at_bottom=True mô phỏng lỗ mở mặt nối liền với nền phía dưới."""
    canvas = np.zeros((size, size, 4), dtype=np.uint8)
    cv2.ellipse(canvas, (size // 2, int(size * 0.45)), (220, 230), 0, 0, 360, (60, 60, 60, 255), -1)
    if hole_open_at_bottom:
        cv2.ellipse(canvas, (size // 2, int(size * 0.72)), (120, 150), 0, 0, 360, (0, 0, 0, 0), -1)
    else:
        cv2.ellipse(canvas, (size // 2, int(size * 0.68)), (110, 95), 0, 0, 360, (0, 0, 0, 0), -1)
    return canvas


def test_cutout_white_background_removes_white():
    bgr = np.full((100, 100, 3), 245, dtype=np.uint8)   # nền trắng
    cv2.circle(bgr, (50, 50), 25, (30, 40, 50), -1)      # vật tối ở giữa
    rgba = cutout_white_background(bgr)
    assert rgba.shape[2] == 4
    assert rgba[5, 5, 3] < 60, "Góc ảnh (nền trắng) phải trong suốt"
    assert rgba[50, 50, 3] > 200, "Tâm vật tối phải giữ nguyên"


def test_find_hairline_enclosed_hole():
    rgba = _synthetic_wig(hole_open_at_bottom=False)
    ratio = find_hairline_ratio(rgba)
    # Ngưỡng quét 55% đẩy mốc xíu dưới mép hình học của lỗ mở mặt
    assert 0.38 <= ratio <= 0.70, f"hairline bất thường: {ratio}"


def test_find_hairline_hole_open_at_bottom():
    rgba = _synthetic_wig(hole_open_at_bottom=True)
    ratio = find_hairline_ratio(rgba)
    # Lỗ hở đáy vẫn phải dò được vùng mở mặt (không rơi fallback 0.40 mù quáng)
    assert 0.38 <= ratio <= 0.70, f"hairline bất thường: {ratio}"


def test_find_hairline_full_wig_fallback():
    canvas = np.zeros((600, 600, 4), dtype=np.uint8)
    cv2.ellipse(canvas, (300, 300), (230, 260), 0, 0, 360, (60, 60, 60, 255), -1)
    assert find_hairline_ratio(canvas) == 0.40


def test_normalize_asset_places_hairline_at_52pct():
    rgba = _synthetic_wig(hole_open_at_bottom=False)
    hairline = find_hairline_ratio(rgba)
    out = normalize_asset(rgba, hairline)
    assert out.shape[:2] == (ASSET_SIZE, ASSET_SIZE)
    out_ratio = find_hairline_ratio(out)
    assert abs(out_ratio - 0.52) < 0.08, f"hairline sau chuẩn hoá phải ~0.52, nhận {out_ratio}"


def test_image_contains_face_on_blank_image():
    bgr = np.full((300, 300, 3), 200, dtype=np.uint8)
    assert image_contains_face(bgr) is False


def test_slugify_handles_vietnamese():
    assert slugify("Tóc Xoăn Sóng Dài") == "toc-xoan-song-dai"
    key = slugify("tóc dại #123 !!!")
    assert all(ch.isalnum() or ch == "-" for ch in key)
    assert len(key) <= 40


def test_normalize_keeps_small_content_centered():
    rgba = np.zeros((600, 600, 4), dtype=np.uint8)
    cv2.rectangle(rgba, (250, 200), (350, 300), (90, 90, 90, 255), -1)
    out = normalize_asset(rgba, 0.5)
    ys, xs = np.nonzero(out[..., 3] > 10)
    center_x = (xs.min() + xs.max()) / 2
    assert abs(center_x - ASSET_SIZE / 2) < 15, "Nội dung nhỏ phải được canh giữa ngang"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
