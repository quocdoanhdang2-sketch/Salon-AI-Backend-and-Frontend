"""
============================================================================
HANA HAIR AI RUNTIME — LOCAL TEXT-TO-HAIR GENERATOR (Stable Diffusion)
============================================================================
Dịch vụ sinh kiểu tóc AI chạy NGAY TRÊN MÁY (GPU NVIDIA RTX 3050 4GB),
không cần API cloud. Kỹ thuật "MASK RỒI REFINE" 2 tầng:

  TẦNG 1 (HÌNH DẠNG): dựng silhouette tóc chuẩn (có sẵn lỗ mở mặt + mốc
          chân tóc) hoặc lấy mặt nạ từ ảnh nháp AI vừa sinh.
  TẦNG 2 (CHẤT LIỆU): Stable Diffusion img2img (strength ~0.62) chỉ vẽ lại
          chất liệu sợi tóc thật TRÊN HÌNH DẠNG SẴN CÓ => mặt người mẫu,
          nền bẩn, chữ loạn không thể xuất hiện.

  Sau đó: cắt nền trắng -> kênh alpha, dò chân tóc, chuẩn hoá canvas
  600x600, ghi PNG vào Code Salon AI Frontend/assets/hairs/ + manifest.json.

Chạy dịch vụ:   Python312/python.exe hair_service.py   (FastAPI, cổng 8010)
Sinh cả bộ:     Python312/python.exe generate_hair_library.py
============================================================================
"""
from __future__ import annotations

import base64
import hashlib
import os
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Cache model HuggingFace mặc định nằm trong ai-runtime/hf-cache (ổ D) —
# tránh làm đầy ổ C vì thường chỉ còn ít dung lượng trống.
os.environ.setdefault(
    "HF_HOME",
    str(Path(__file__).resolve().parent / "hf-cache"),
)

FRONTEND_DIR = Path(__file__).resolve().parents[1] / "Code Salon AI Frontend"
HAIRS_DIR = FRONTEND_DIR / "assets" / "hairs"
MANIFEST_PATH = HAIRS_DIR / "manifest.json"
ASSET_SIZE = 600
GEN_W, GEN_H = 512, 640

# Dựng silhouette procedural (hình dạng tóc chuẩn có sẵn trong repo)
TOOLS_DIR = FRONTEND_DIR / "tools"
sys.path.insert(0, str(TOOLS_DIR))

# --------------------------------------------------------------------------
# Model loader (nạp MỘT LẦN duy nhất, giữ trên VRAM)
# --------------------------------------------------------------------------
_models: dict = {}
_model_error: Optional[str] = None
SD_MODEL_ID = os.environ.get("SD_MODEL_ID", "stable-diffusion-v1-5/stable-diffusion-v1-5")


def get_pipes():
    """Nạp SD 1.5 fp16 + pipeline img2img dùng CHUNG weights (~2.2GB VRAM)."""
    global _model_error
    if "t2i" in _models:
        return _models["t2i"], _models["i2i"]
    if _model_error:
        raise HTTPException(status_code=503, detail=_model_error)

    import torch
    from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image

    if not torch.cuda.is_available():
        _model_error = "GPU NVIDIA không khả dụng (torch.cuda.is_available() = False)."
        raise HTTPException(status_code=503, detail=_model_error)

    try:
        gpu_name = torch.cuda.get_device_name(0)
        print(f"[hair_service] Đang nạp {SD_MODEL_ID} lên {gpu_name} ...")
        t2i = AutoPipelineForText2Image.from_pretrained(
            SD_MODEL_ID,
            torch_dtype=torch.float16,
            variant="fp16",
            safety_checker=None,
            requires_safety_checker=False,
        ).to("cuda")
        i2i = AutoPipelineForImage2Image.from_pipe(t2i)   # dùng chung weights
        for pipe in (t2i, i2i):
            pipe.enable_attention_slicing()
            pipe.set_progress_bar_config(disable=True)
        _models["t2i"], _models["i2i"] = t2i, i2i
        _models["torch"] = torch
        print("[hair_service] Model đã sẵn sàng nhận lệnh sinh tóc!")
        return t2i, i2i
    except Exception as exc:  # pragma: no cover
        _model_error = f"Không nạp được model sinh ảnh: {exc}"
        print("[hair_service] LỖI:", _model_error)
        raise HTTPException(status_code=503, detail=_model_error)


# --------------------------------------------------------------------------
# Prompt & sinh ảnh
# --------------------------------------------------------------------------
HAIR_STYLE_SUFFIX = (
    "realistic human hair wig, natural hair strands with soft shine, "
    "salon catalogue photo, plain pure white background, soft studio lighting"
)
NEGATIVE = (
    "face, human face, eyes, nose, lips, skin, woman, man, person, model, "
    "mannequin, head, neck, shoulders, body, hands, colored background, "
    "outdoor, wall, text, watermark, logo, blurry, lowres, deformed"
)


def t2i_draft(prompt: str, seed: int, steps: int = 22) -> np.ndarray:
    """Tầng nháp: sinh ảnh thô từ chữ (chỉ để lấy mặt nạ vùng tóc)."""
    import torch
    t2i, _ = get_pipes()
    generator = torch.Generator(device="cuda").manual_seed(seed)
    with torch.inference_mode():
        image = t2i(
            prompt=f"{prompt}, {HAIR_STYLE_SUFFIX}",
            negative_prompt=NEGATIVE,
            num_inference_steps=steps,
            guidance_scale=7.5,
            height=GEN_H,
            width=GEN_W,
            generator=generator,
        ).images[0]
    return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)


def i2i_refine(bgr_init: np.ndarray, prompt: str, seed: int, strength: float = 0.62, steps: int = 24) -> np.ndarray:
    """Tầng tinh chỉnh: vẽ lại chất liệu tóc trên hình dạng có sẵn (img2img)."""
    import torch
    from PIL import Image
    _, i2i = get_pipes()
    pil_init = Image.fromarray(cv2.cvtColor(bgr_init, cv2.COLOR_BGR2RGB))
    generator = torch.Generator(device="cuda").manual_seed(seed)
    with torch.inference_mode():
        image = i2i(
            prompt=f"{prompt}, {HAIR_STYLE_SUFFIX}",
            negative_prompt=NEGATIVE,
            image=pil_init,
            strength=strength,
            num_inference_steps=steps,
            guidance_scale=7.5,
            generator=generator,
        ).images[0]
    return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)


_face_cascade = None


def image_contains_face(bgr: np.ndarray) -> bool:
    """Cổng chất lượng: phát hiện mặt người trong ảnh sinh ra (Haar cascade).
    Có mặt => LOẠI, bắt buộc sinh lại seed khác."""
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6, minSize=(90, 90))
    return len(faces) > 0


# --------------------------------------------------------------------------
# Hậu xử lý ảnh
# --------------------------------------------------------------------------
def cutout_white_background(bgr: np.ndarray) -> np.ndarray:
    """Tách nền trắng thuần -> RGBA. Nền studio trắng nên dùng ngưỡng độ sáng
    kết hợp độ bão hoà thấp, có feather mềm ở viền."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    sat_max = max(30.0, float(np.percentile(s, 55)) * 0.6)
    bg_mask = ((v > 150) & (s < sat_max)).astype(np.uint8) * 255

    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    alpha = 255 - bg_mask
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.6)
    return np.dstack([bgr, alpha])


def _rgba_painted_to_init(rgba: np.ndarray, with_mask: bool = False):
    """Ghép ảnh tóc ĐÃ VẼ SẴN SỢI (procedural RGBA) lên nền trắng, căn giữa
    khung GEN_W x GEN_H — ảnh init giàu chi tiết cho img2img tạo tóc thật."""
    alpha = rgba[..., 3]
    ys, xs = np.nonzero(alpha > 40)
    if len(xs) == 0:
        raise ValueError('Ảnh tóc rỗng')
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    content = rgba[y0:y1, x0:x1]
    scale = min((GEN_W - 40) / content.shape[1], (GEN_H - 60) / content.shape[0])
    new_w, new_h = max(1, int(content.shape[1] * scale)), max(1, int(content.shape[0] * scale))
    resized = cv2.resize(content, (new_w, new_h), interpolation=cv2.INTER_AREA)

    init = np.full((GEN_H, GEN_W, 3), 255, dtype=np.uint8)
    mask_frame = np.zeros((GEN_H, GEN_W), dtype=np.uint8)
    px, py = (GEN_W - new_w) // 2, (GEN_H - new_h) // 2
    region = init[py:py + new_h, px:px + new_w]
    a = (resized[..., 3:4].astype(np.float32)) / 255.0
    region_f = region.astype(np.float32) * (1 - a) + resized[..., :3].astype(np.float32) * a
    init[py:py + new_h, px:px + new_w] = region_f.astype(np.uint8)
    mask_frame[py:py + new_h, px:px + new_w] = (resized[..., 3] > 128).astype(np.uint8) * 255
    if with_mask:
        return init, mask_frame
    return init


def _alpha_crop_to_init(alpha: np.ndarray, gray_bgr=(85, 95, 105)) -> np.ndarray:
    """Căn giữa vùng tóc (từ mặt nạ alpha) vào khung GEN_W x GEN_H nền trắng,
    tô vùng tóc màu xám nâu trung tính — ảnh init cho img2img."""
    ys, xs = np.nonzero(alpha > 40)
    if len(xs) == 0:
        raise ValueError("Mặt nạ tóc rỗng")
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = alpha[y0:y1, x0:x1]
    scale = min((GEN_W - 40) / crop.shape[1], (GEN_H - 60) / crop.shape[0])
    new_w, new_h = max(1, int(crop.shape[1] * scale)), max(1, int(crop.shape[0] * scale))
    resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)

    init = np.full((GEN_H, GEN_W, 3), 255, dtype=np.uint8)
    px, py = (GEN_W - new_w) // 2, (GEN_H - new_h) // 2
    region = init[py:py + new_h, px:px + new_w]
    region[resized > 128] = np.array(gray_bgr, dtype=np.uint8)
    return init


def _enforce_mask(rgba: np.ndarray, mask_frame: np.ndarray, feather_px: int = 6) -> np.ndarray:
    """Ép kết quả AI vào đúng silhouette gốc: mọi thứ vẽ thừa ngoài dáng tóc
    (tai, mặt, nền, đốm) bị cắt sạch. Nới mask vài px cho viền tóc thoải mái."""
    allowed = cv2.dilate(mask_frame, np.ones((feather_px * 2 + 1, feather_px * 2 + 1), np.uint8))
    allowed_f = cv2.GaussianBlur(allowed, (0, 0), feather_px / 2).astype(np.float32) / 255.0
    rgba = rgba.copy()
    rgba[..., 3] = (rgba[..., 3].astype(np.float32) * allowed_f).astype(np.uint8)
    return rgba


def find_hairline_ratio(rgba: np.ndarray) -> float:
    """Dò chân tóc bằng BĂNG GIỮA 1/3 ảnh: hàng đầu tiên (từ trên xuống)
    mà dải ngang giữa ảnh trống hơn 60% — đó là mép trên vùng mở mặt.
    Chống nhiễu với kiểu rẽ ngôi giữa (khe hẹp ở giữa không đủ để triger)."""
    alpha = rgba[..., 3]
    h, w = alpha.shape
    solid = (alpha > 60)
    c0, c1 = int(w * 0.33), int(w * 0.67)

    consecutive = 0
    for y in range(int(h * 0.15), int(h * 0.92)):
        band = solid[y, c0:c1]
        if band.mean() < 0.40:            # băng giữa trống > 60%
            consecutive += 1
            if consecutive >= 3:          # phải trống 3 hàng liên tiếp
                return round((y - 2) / h, 3)
        else:
            consecutive = 0
    # Tóc phủ kín (fringe phủ hết trán) -> neo ở 40% chiều cao
    return 0.40


def normalize_asset(rgba: np.ndarray, hairline_ratio: float) -> np.ndarray:
    """Cắt sát nội dung rồi đưa về canvas 600x600, bảo đảm mốc chân tóc
    nằm đúng 52% chiều cao (đúng chuẩn engine neo lên trán)."""
    alpha = rgba[..., 3]
    ys, xs = np.nonzero(alpha > 12)
    if len(xs) == 0:
        return rgba

    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    content = rgba[y0:y1 + 1, x0:x1 + 1]
    ch, cw = content.shape[:2]

    current_ratio = (y0 + hairline_ratio * (y1 - y0 + 1))
    target_hairline = ASSET_SIZE * 0.52
    offset_y = int(round(target_hairline - current_ratio))
    offset_x = int(round((ASSET_SIZE - cw) / 2))

    if ch > ASSET_SIZE * 0.96 or cw > ASSET_SIZE:
        scale = min(ASSET_SIZE / cw, (ASSET_SIZE * 0.96) / ch)
        content = cv2.resize(content, (max(1, int(cw * scale)), max(1, int(ch * scale))), interpolation=cv2.INTER_AREA)
        ch, cw = content.shape[:2]
        offset_x = int(round((ASSET_SIZE - cw) / 2))
        offset_y = int(round(target_hairline - hairline_ratio * ch))

    canvas = np.zeros((ASSET_SIZE, ASSET_SIZE, 4), dtype=np.uint8)
    dx0, dy0 = max(0, offset_x), max(0, offset_y)
    dx1, dy1 = min(ASSET_SIZE, offset_x + cw), min(ASSET_SIZE, offset_y + ch)
    sx0, sy0 = dx0 - offset_x, dy0 - offset_y
    canvas[dy0:dy1, dx0:dx1] = content[sy0:sy0 + (dy1 - dy0), sx0:sx0 + (dx1 - dx0)]
    return canvas


def auto_adjust_lighting(rgba: np.ndarray) -> np.ndarray:
    """Nới nhẹ độ tương phản vùng tóc cho giống ảnh sống (CLAHE trên kênh L)."""
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB)
    l_channel = lab[..., 0]
    mask = (rgba[..., 3] > 40).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    lab[..., 0] = np.where(mask > 0, clahe.apply(l_channel), l_channel)
    out_bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    return np.dstack([out_bgr, rgba[..., 3]])


# --------------------------------------------------------------------------
# Pipelines đầu-cuối
# --------------------------------------------------------------------------
def build_hair_asset_from_silhouette(desc: str, style_key: str, seed: int,
                                     strength: float = 0.62, steps: int = 24) -> tuple[np.ndarray, dict]:
    """Sinh tóc cho 8 kiểu chuẩn: silhouette procedural -> img2img refine.
    Hình dạng luôn đúng, không thể dính mặt người mẫu."""
    from generate_hair_assets import build_base_silhouette, paint_hair
    mask = build_base_silhouette(style_key)
    painted = paint_hair(mask, seed % 1000)
    init, mask_frame = _rgba_painted_to_init(painted, with_mask=True)

    bgr = i2i_refine(init, desc, seed, strength=0.5, steps=steps)
    rgba = cutout_white_background(bgr)
    rgba = _enforce_mask(rgba, mask_frame)
    if (rgba[..., 3] > 40).mean() < 0.06:
        raise HTTPException(status_code=502, detail="Ảnh tinh chỉnh mất vùng tóc, thử seed khác.")
    hairline = find_hairline_ratio(rgba)
    rgba = normalize_asset(rgba, hairline)
    rgba = auto_adjust_lighting(rgba)
    meta = {"hairline": find_hairline_ratio(rgba), "steps": steps, "seed": seed, "mode": "silhouette-i2i"}
    return rgba, meta


def _mask_shape_ok(rgba: np.ndarray) -> bool:
    """Cổng hình dạng: mặt nạ tóc hợp lệ phải giống silhouette tóc —
    KHÔNG phải hình chữ nhật/ô vuông lấp đầy khung (ảnh nháp rác)."""
    alpha = rgba[..., 3]
    solid = alpha > 60
    coverage = float(solid.mean())
    if not (0.06 < coverage < 0.60):
        return False
    ys, xs = np.nonzero(solid)
    if len(xs) == 0:
        return False
    bw = xs.max() - xs.min() + 1
    bh = ys.max() - ys.min() + 1
    if bw < rgba.shape[1] * 0.25 or bh < rgba.shape[0] * 0.30:
        return False  # quá nhỏ, không phải kiểu tóc
    fill_ratio = float(solid.sum()) / float(bw * bh)
    # Silhouette tóc thật chiếm 35-82% khung bao; khối chữ nhật đặc ~100%
    return 0.32 <= fill_ratio <= 0.82


def _pick_silhouette_for_prompt(prompt: str) -> str:
    """Chọn silhouette chuẩn khớp nhất với mô tả tiếng Việt của khách."""
    p = prompt.lower()
    if any(k in p for k in ('nam', 'đàn ông', 'dan ong', 'side part', '7/3')):
        return 'sidepart_nam' if 'side' in p or '7/3' in p else 'layer_nam'
    if 'pixie' in p or 'tém' in p:
        return 'pixie_nu'
    if 'wolf' in p or 'shag' in p:
        return 'wolf_cut'
    if 'bob' in p or 'ngắn' in p or 'ngan' in p:
        return 'bob_nu'
    if 'thẳng' in p or 'thang' in p or 'suôn' in p or 'suon' in p or 'dài thẳng' in p:
        return 'straight_silk'
    if any(k in p for k in ('xoăn', 'xoan', 'sóng', 'song', 'uốn', 'uon', 'wave', 'curl', 'bồng bềnh', 'bongbenh')):
        return 'wave_nu'
    return 'layer_nu'


def build_hair_asset_from_prompt(desc: str, seed: int, steps: int = 26) -> tuple[np.ndarray, dict]:
    """Sinh tóc tự do theo mô tả khách: chọn silhouette chuẩn KHỚP TỪ KHÓA
    làm dáng gốc (bảo đảm luôn ra dáng tóc), rồi img2img strength cao để
    restyle màu sắc/chất liệu đúng theo mô tả. Không thể ra hình dạng rác."""
    style_key = _pick_silhouette_for_prompt(desc)
    from generate_hair_assets import build_base_silhouette, paint_hair
    mask = build_base_silhouette(style_key)
    painted = paint_hair(mask, seed % 1000)
    init, mask_frame = _rgba_painted_to_init(painted, with_mask=True)

    bgr = None
    for attempt in range(3):
        bgr = i2i_refine(init, desc, seed + 31 * (attempt + 1), strength=0.72, steps=steps)
        if not image_contains_face(bgr):
            break
        print(f"[hair_service] Ảnh còn dính mặt (lần {attempt + 1}) -> thử seed khác...")
    else:
        raise HTTPException(status_code=502, detail="Mô tả này khó tách tóc khỏi người mẫu, thử diễn đạt khác.")

    rgba = cutout_white_background(bgr)
    rgba = _enforce_mask(rgba, mask_frame)
    if (rgba[..., 3] > 40).mean() < 0.06:
        raise HTTPException(status_code=502, detail="Ảnh sinh ra không tách được tóc khỏi nền.")
    hairline = find_hairline_ratio(rgba)
    rgba = normalize_asset(rgba, hairline)
    rgba = auto_adjust_lighting(rgba)
    meta = {"hairline": find_hairline_ratio(rgba), "steps": steps, "seed": seed,
            "mode": f"prompt-restyle:{style_key}"}
    return rgba, meta


def save_asset(rgba: np.ndarray, key: str, label: str, meta: dict, prompt_desc: str) -> dict:
    """Lưu PNG + cập nhật manifest.json cho engine đọc mốc neo."""
    import json
    HAIRS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = HAIRS_DIR / f"{key}.png"
    cv2.imwrite(str(out_path), rgba)

    manifest = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}
    manifest[key] = {
        "label": label,
        "anchorY": meta.get("hairline", 0.52),
        "source": f"sd15-local-{meta.get('mode', 'i2i')}",
        "prompt": prompt_desc,
        "seed": meta.get("seed"),
        "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"key": key, "file": out_path.name, "anchorY": manifest[key]["anchorY"]}


def slugify(text: str, fallback: str = "toc") -> str:
    """Tên file an toàn: bỏ dấu tiếng Việt, chỉ giữ chữ số và gạch."""
    import unicodedata
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    cleaned = "".join(ch if ch.isalnum() else "-" for ch in ascii_text.lower())
    cleaned = "-".join(part for part in cleaned.split("-") if part)[:40]
    if not cleaned:
        cleaned = fallback
    if all(ord(ch) < 128 for ch in text) is False and cleaned == fallback:
        cleaned += "-" + hashlib.md5(text.encode("utf-8")).hexdigest()[:6]
    return cleaned


# --------------------------------------------------------------------------
# FastAPI service
# --------------------------------------------------------------------------
app = FastAPI(title="Hana Hair AI Runtime — SD 1.5 Local (mask-refine)")


class GenerateHairRequest(BaseModel):
    prompt: str                    # mô tả tiếng Việt hoặc Anh
    label: Optional[str] = None    # tên hiển thị
    steps: int = 22
    seed: Optional[int] = None


class GenerateHairResponse(BaseModel):
    success: bool
    key: str
    label: str
    anchorY: float
    imageDataUrl: str
    elapsedMs: int


@app.get("/health")
def health():
    import torch
    return {
        "success": True,
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "cuda": torch.cuda.is_available(),
        "model": SD_MODEL_ID,
        "modelLoaded": "t2i" in _models,
    }


@app.post("/generate-hair", response_model=GenerateHairResponse)
def generate_hair(req: GenerateHairRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Thiếu mô tả kiểu tóc (prompt).")
    started = time.time()
    base_seed = req.seed if req.seed is not None else int(time.time())
    rgba, meta = build_hair_asset_from_prompt(req.prompt.strip(), base_seed, steps=max(14, min(30, req.steps)))

    base_key = "ai_" + slugify(req.label or req.prompt, fallback="custom")
    key = base_key
    if (HAIRS_DIR / f"{key}.png").exists():
        key = f"{base_key}-{hashlib.md5((req.prompt + str(base_seed)).encode()).hexdigest()[:6]}"

    label = (req.label or req.prompt).strip()[:60]
    saved = save_asset(rgba, key, label, meta, req.prompt.strip())

    ok, buf = cv2.imencode(".png", rgba)
    data_url = "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    return GenerateHairResponse(
        success=True,
        key=key,
        label=label,
        anchorY=saved["anchorY"],
        imageDataUrl=data_url,
        elapsedMs=int((time.time() - started) * 1000),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("HAIR_GEN_PORT", "8010")))
