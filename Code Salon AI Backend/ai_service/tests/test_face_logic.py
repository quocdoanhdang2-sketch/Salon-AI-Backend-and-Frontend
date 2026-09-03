import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from face_logic import classify_face_shape, recommend_hairstyle, estimate_face_landmarks, build_overlay_config


def test_classify_oval_shape():
    result = classify_face_shape(
        face_width=180,
        face_height=210,
        forehead_width=150,
        jaw_width=120,
        cheekbone_width=150,
    )
    assert result == 'oval'


def test_recommend_hairstyle_for_oval():
    result = recommend_hairstyle('oval', 'warm')
    assert 'layer' in result['style'].lower() or 'bob' in result['style'].lower()
    assert 'reason' in result


def test_estimate_face_landmarks_returns_points():
    landmarks = estimate_face_landmarks(face_width=200, face_height=240)
    assert 'head_center' in landmarks
    assert landmarks['head_center'][0] > 0
    assert landmarks['head_center'][1] > 0


def test_build_overlay_config_returns_render_data():
    overlay = build_overlay_config('oval', [10, 20, 200, 240], estimate_face_landmarks(face_width=200, face_height=240))
    assert overlay['face_shape'] == 'oval'
    assert overlay['scale'] > 0
    assert 'hair_region' in overlay
    assert overlay['hair_region']['width'] > 0
