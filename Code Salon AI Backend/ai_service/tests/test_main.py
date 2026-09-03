import asyncio
import base64

from ai_service import main


def test_analyze_face_uses_safe_temporary_file_and_cleans_it_up():
    seen = {}

    def fake_analyze(path):
        seen['path'] = path
        assert path.exists()
        return {
            'face_shape': 'oval',
            'confidence': 90,
            'metrics': {},
            'landmarks': {},
            'overlay': {},
            'recommendation': {},
        }

    original_analyze = main.analyze_face_metrics
    main.analyze_face_metrics = fake_analyze
    try:
        payload = main.Base64ImageRequest(
            imageBase64='data:image/png;base64,' + base64.b64encode(b'test image').decode(),
            filename='../unsafe-name.png',
        )
        result = asyncio.run(main.analyze_face(payload=payload))
    finally:
        main.analyze_face_metrics = original_analyze

    assert result['success'] is True
    assert result['data']['source_file'] == 'unsafe-name.png'
    assert seen['path'].parent == main.UPLOAD_DIR
    assert not seen['path'].exists()


def test_decode_base64_image_rejects_invalid_data():
    try:
        main.decode_base64_image('not-base64!')
    except main.HTTPException as error:
        assert error.status_code == 400
    else:
        raise AssertionError('Expected an HTTP 400 error for invalid base64.')
