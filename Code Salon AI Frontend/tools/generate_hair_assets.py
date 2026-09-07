"""
============================================================================
HANA HAIR SALON - HAIR OVERLAY ASSET GENERATOR
============================================================================
Sinh 8 file PNG trong suốt (600x600, RGBA) cho Virtual Try-On 2D của
cv-hair-engine.js. Mỗi ảnh mô tả 1 kiểu tóc nhìn thẳng, nền trong suốt,
có mốc "hairline" (đường chân tóc trán) đặt tại 52% chiều cao ảnh để
engine neo đúng điểm landmark số 10 (đỉnh trán) của MediaPipe.

Cách chạy (từ thư mục Backend, dùng venv có sẵn OpenCV):
    python tools/generate_hair_assets.py

Output: Code Salon AI Frontend/assets/hairs/<key>.png
============================================================================
"""
from __future__ import annotations

import math
import os
from pathlib import Path

import cv2
import numpy as np

SIZE = 600
HAIRLINE = int(SIZE * 0.52)          # 312px - mốc chân tóc trán
CX = SIZE // 2                        # 300px - trục giữa

# Bảng màu gốc: nâu tự nhiên (engine sẽ multiply thêm màu nhuộm khi khách chọn)
BASE_BGR = (36, 56, 82)               # #523824 ~ nâu tự nhiên (BGR)
DARK_BGR = (18, 30, 46)               # chân tóc đậm hơn
LIGHT_BGR = (110, 150, 196)           # lược sáng phản quang
BG_LIGHT = (128, 118, 108)            # lớp nền phụ tạo chiều sâu


def _blank() -> np.ndarray:
    return np.zeros((SIZE, SIZE, 4), dtype=np.uint8)


def _ellipse_mask(cx, cy, rx, ry, angle=0) -> np.ndarray:
    mask = np.zeros((SIZE, SIZE), dtype=np.uint8)
    cv2.ellipse(mask, (int(cx), int(cy)), (int(rx), int(ry)), angle, 0, 360, 255, -1)
    return mask


def _polygon_mask(pts) -> np.ndarray:
    mask = np.zeros((SIZE, SIZE), dtype=np.uint8)
    cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], 255)
    return mask


def _union(masks) -> np.ndarray:
    out = np.zeros((SIZE, SIZE), dtype=np.uint8)
    for m in masks:
        out = cv2.bitwise_or(out, m)
    return out


def _subtract(base: np.ndarray, minus: np.ndarray) -> np.ndarray:
    return cv2.bitwise_and(base, cv2.bitwise_not(minus))


def _jagged_edge(y_top, y_bottom, x_base, amplitude, teeth, direction=1, seed=7):
    """Sinh đường viền răng cưa (layer tóc) từ trên xuống dưới."""
    rng = np.random.default_rng(seed)
    pts = []
    for i in range(teeth + 1):
        y = y_top + (y_bottom - y_top) * i / teeth
        x = x_base + direction * amplitude * (0.4 + rng.random())
        pts.append((x, y))
    return pts


def build_base_silhouette(style: str) -> np.ndarray:
    """Dựng mặt nạ silhouette cơ bản của từng kiểu tóc."""
    cap = _ellipse_mask(CX, HAIRLINE - 40, 224, 190)                 # vòm đầu
    crown_top = _ellipse_mask(CX, HAIRLINE - 105, 150, 105)          # đỉnh đầu cao hơn
    face_open = _ellipse_mask(CX, HAIRLINE + 158, 132, 152)          # vùng mặt để trống (nhỏ -> màn tóc dày)

    if style in ('layer_nu', 'straight_silk'):
        # Tóc dài thẳng/layer: hai hồi tóc suôn xuống gần đáy ảnh
        left = _polygon_mask([
            (CX - 226, HAIRLINE - 70), (CX - 252, HAIRLINE + 130),
            (CX - 246, HAIRLINE + 300), (CX - 226, SIZE - 4),
            (CX - 96, SIZE - 2), (CX - 122, HAIRLINE + 80),
            (CX - 112, HAIRLINE - 30),
        ])
        right = _polygon_mask([
            (CX + 226, HAIRLINE - 70), (CX + 252, HAIRLINE + 130),
            (CX + 246, HAIRLINE + 300), (CX + 226, SIZE - 4),
            (CX + 96, SIZE - 2), (CX + 122, HAIRLINE + 80),
            (CX + 112, HAIRLINE - 30),
        ])
        mask = _union([cap, crown_top, left, right])
        mask = _subtract(mask, face_open)
        if style == 'layer_nu':
            # Layer: cắt tỉa chóp tầng
            for i in range(9):
                y = HAIRLINE + 150 + i * 16
                x = 88 + i * 6 if i % 2 == 0 else 96 + i * 5
                notch = _ellipse_mask(CX - 190, y, 34, 12, 25)
                mask = _subtract(mask, notch)
                notch_r = _ellipse_mask(CX + 190, y, 34, 12, -25)
                mask = _subtract(mask, notch_r)
        # Mái bay chéo trán
        bangs = _polygon_mask([
            (CX - 150, HAIRLINE - 46), (CX + 150, HAIRLINE - 52),
            (CX + 128, HAIRLINE - 8), (CX - 60, HAIRLINE + 16), (CX - 146, HAIRLINE - 4),
        ])
        mask = cv2.bitwise_or(mask, bangs)
        return mask

    if style == 'wave_nu':
        # Sóng lơi: viền hai bên uốn cong sóng sinh sĩ
        pts_l, pts_r = [], []
        for i in range(25):
            t = i / 24
            y = HAIRLINE - 50 + (SIZE - 4 - (HAIRLINE - 50)) * t
            swing = math.sin(t * math.pi * 2.4) * 24
            pts_l.append((max(6, CX - 242 + t * 14 - swing), y))
            pts_r.append((min(SIZE - 6, CX + 242 - t * 14 + swing), y))
        body_l = _polygon_mask(pts_l + [(CX - 110, HAIRLINE + 60), (CX - 118, SIZE - 8)])
        body_r = _polygon_mask(pts_r + [(CX + 110, HAIRLINE + 60), (CX + 118, SIZE - 8)])
        mask = _union([cap, crown_top, body_l, body_r])
        return _subtract(mask, face_open)

    if style == 'bob_nu':
        # Bob ngắn: vòm tròn ôm xuống ngang cằm, đuôi cụp nhẹ vào trong
        sides = _union([
            _ellipse_mask(CX - 196, HAIRLINE + 40, 84, 132, 8),
            _ellipse_mask(CX + 196, HAIRLINE + 40, 84, 132, -8),
            _ellipse_mask(CX - 188, HAIRLINE + 150, 70, 92, 18),
            _ellipse_mask(CX + 188, HAIRLINE + 150, 70, 92, -18),
            _ellipse_mask(CX - 160, HAIRLINE + 216, 58, 62, 24),
            _ellipse_mask(CX + 160, HAIRLINE + 216, 58, 62, -24),
        ])
        mask = _union([cap, crown_top, sides])
        return _subtract(mask, face_open)

    if style == 'wolf_cut':
        # Wolf cut: crown phồng + tầng răng cưa lởm chởm quanh vai
        shag = _union([_ellipse_mask(CX - 162, HAIRLINE + 170, 118, 170, 12),
                       _ellipse_mask(CX + 162, HAIRLINE + 170, 118, 170, -12)])
        mask = _union([cap, crown_top, shag])
        rng = np.random.default_rng(42)
        for _ in range(26):
            ang = rng.uniform(0, math.pi)
            side = -1 if math.cos(ang) < 0 else 1
            r = rng.uniform(150, 235)
            x = CX + side * abs(math.cos(ang)) * r
            y = HAIRLINE + 40 + abs(math.sin(ang)) * 180
            spike = _polygon_mask([
                (x - 16, y), (x + 16, y), (x + side * 6, y + rng.uniform(46, 96))
            ])
            mask = cv2.bitwise_or(mask, spike)
        # Cắt vùng mặt SAU CÙNG để gai không đâm vào vùng mặt
        return _subtract(mask, face_open)

    if style == 'pixie_nu':
        # Pixie: cap ngắn gọn, hai bên sát má, mái quét lệch
        sides = _union([
            _ellipse_mask(CX - 196, HAIRLINE + 6, 62, 84, 6),
            _ellipse_mask(CX + 196, HAIRLINE + 6, 62, 84, -6),
        ])
        mask = _union([cap, crown_top, sides])
        mask = _subtract(mask, face_open)
        fringe = _ellipse_mask(CX - 66, HAIRLINE - 26, 120, 40, -12)
        return cv2.bitwise_or(mask, fringe)

    if style in ('layer_nam', 'sidepart_nam'):
        # Tóc nam ngắn: cap ôm sát, mai ngắn, mái phồng trước
        sides = _union([
            _ellipse_mask(CX - 206, HAIRLINE - 20, 74, 88, 4),
            _ellipse_mask(CX + 206, HAIRLINE - 20, 74, 88, -4),
            _ellipse_mask(CX - 214, HAIRLINE + 40, 52, 64, 10),
            _ellipse_mask(CX + 214, HAIRLINE + 40, 52, 64, -10),
        ])
        mask = _union([cap, crown_top, sides])
        mask = _subtract(mask, _ellipse_mask(CX, HAIRLINE + 120, 150, 130))
        if style == 'layer_nam':
            # Mái layer xước kéo dài xuống trán
            fringe = _polygon_mask([
                (CX - 176, HAIRLINE - 56), (CX + 150, HAIRLINE - 66),
                (CX + 140, HAIRLINE - 18), (CX + 40, HAIRLINE + 26),
                (CX - 96, HAIRLINE + 10), (CX - 176, HAIRLINE - 16),
            ])
            return cv2.bitwise_or(mask, fringe)
        # Side part 7/3: vòm lệch phải, đường ngôi rõ
        sweep = _ellipse_mask(CX + 44, HAIRLINE - 66, 178, 96, 14)
        part_line = _polygon_mask([
            (CX + 66, HAIRLINE - 150), (CX + 82, HAIRLINE - 148),
            (CX + 40, HAIRLINE - 60), (CX + 28, HAIRLINE - 62),
        ])
        mask = _subtract(mask, part_line)
        return cv2.bitwise_or(mask, sweep)

    raise ValueError(f'Không biết kiểu tóc: {style}')


def paint_hair(mask: np.ndarray, seed: int = 11) -> np.ndarray:
    """Tô màu + vẽ lược tóc sáng/tối bên trong silhouette, xuất RGBA."""
    rng = np.random.default_rng(seed)
    rgba = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)

    # Nền màu gốc: gradient dọc đậm dần ở chân tóc
    grad = np.linspace(1.25, 0.72, SIZE, dtype=np.float32)[:, None]
    base = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    base[..., 0] = BASE_BGR[0] * grad
    base[..., 1] = BASE_BGR[1] * grad
    base[..., 2] = BASE_BGR[2] * grad

    # Lớp nền phụ tạo khối (nhưng không đè lên vùng trong suốt)
    under = np.zeros_like(base)
    under[..., 0] = BG_LIGHT[0]
    under[..., 1] = BG_LIGHT[1]
    under[..., 2] = BG_LIGHT[2]
    wide = cv2.GaussianBlur(mask, (0, 0), 9)
    factor = (wide.astype(np.float32) / 255.0)[..., None]
    base = base * 0.82 + under * 0.18 * factor

    # Vẽ từng lược tóc: đường cong nhẹ từ chân tóc chảy xuống đuôi
    strand_layer = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    strand_alpha = np.zeros((SIZE, SIZE), dtype=np.float32)
    ys, xs = np.nonzero(mask)
    if len(xs):
        for _ in range(90):
            x0 = rng.choice(xs)
            col = mask[:, max(0, min(SIZE - 1, x0))]
            rows = np.nonzero(col)[0]
            if len(rows) < 30:
                continue
            y0 = int(rows.max() * rng.uniform(0.35, 0.55))
            y1 = int(rows.max())
            bend = rng.uniform(-34, 34)
            color = LIGHT_BGR if rng.random() < 0.42 else DARK_BGR
            strength = rng.uniform(22, 66)
            width = int(rng.integers(1, 4))
            pts = []
            for t in np.linspace(0, 1, 10):
                y = y0 + (y1 - y0) * t
                x = x0 + bend * math.sin(t * math.pi * rng.uniform(0.7, 1.4))
                pts.append((int(x), int(y)))
            overlay = np.zeros((SIZE, SIZE), dtype=np.uint8)
            cv2.polylines(overlay, [np.array(pts, np.int32)], False, 255, width, cv2.LINE_AA)
            m = (overlay.astype(np.float32) / 255.0) * (strength / 255.0)
            strand_layer[..., 0] += color[0] * m
            strand_layer[..., 1] += color[1] * m
            strand_layer[..., 2] += color[2] * m
            strand_alpha += m

    # Chân tóc đậm hơn: làm tối phần trên cùng của silhouette
    root_shade = cv2.GaussianBlur(mask, (0, 0), 14).astype(np.float32) / 255.0
    root_weight = np.clip((HAIRLINE + 90 - np.arange(SIZE)[:, None]) / 260.0, 0, 1)
    root_weight = np.clip(root_weight * root_shade, 0, 0.55)
    base *= (1.0 - root_weight[..., None] * 0.55)

    # Tầng bóng phản quang nhẹ ở đỉnh vòm (mờ rộng, đủ tinh tế để không giống vết hói)
    gloss = cv2.GaussianBlur(_ellipse_mask(CX, HAIRLINE - 115, 110, 54), (0, 0), 22).astype(np.float32) / 255.0
    base += np.array([28, 36, 46], np.float32) * (gloss * 0.35)[..., None]

    rgb_final = np.clip(base + strand_layer, 0, 255)
    alpha = cv2.GaussianBlur(mask, (0, 0), 2.2)
    alpha = np.clip(alpha.astype(np.float32) + strand_alpha * 0, 0, 255)

    rgba[..., :3] = rgb_final.astype(np.uint8)
    rgba[..., 3] = alpha.astype(np.uint8)
    return rgba


STYLES = {
    'layer_nu': 5,
    'wave_nu': 12,
    'bob_nu': 21,
    'wolf_cut': 33,
    'straight_silk': 44,
    'pixie_nu': 52,
    'layer_nam': 63,
    'sidepart_nam': 71,
}


def generate(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for style, seed in STYLES.items():
        mask = build_base_silhouette(style)
        mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        rgba = paint_hair(mask, seed)
        target = out_dir / f'{style}.png'
        cv2.imwrite(str(target), rgba)
        coverage = float((rgba[..., 3] > 10).mean())
        print(f'  [OK] {target.name:<22} phủ {coverage * 100:.1f}% ảnh')

    # Bảng xem nhanh tất cả các mẫu trên nền kiểm tra trong suốt
    sheet = np.full((SIZE * 2, SIZE * 4, 3), 235, dtype=np.uint8)
    for i, style in enumerate(STYLES):
        png = cv2.imread(str(out_dir / f'{style}.png'), cv2.IMREAD_UNCHANGED)
        cell = np.full((SIZE, SIZE, 3), 235, dtype=np.uint8)
        a = png[..., 3:4].astype(np.float32) / 255.0
        cell = (png[..., :3].astype(np.float32) * a + cell * (1 - a)).astype(np.uint8)
        r, c = divmod(i, 4)
        sheet[r * SIZE:(r + 1) * SIZE, c * SIZE:(c + 1) * SIZE] = cell
    cv2.imwrite(str(out_dir / '_preview_sheet.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(f'  [OK] _preview_sheet.jpg (xem nhanh toàn bộ mẫu)')
    print(f'Hoàn tất: {len(STYLES)} kiểu tóc tại {out_dir}')


if __name__ == '__main__':
    default_out = Path(__file__).resolve().parents[1] / 'assets' / 'hairs'
    generate(default_out)
