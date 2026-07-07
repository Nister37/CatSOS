import base64
from io import BytesIO

import qrcode
from django.conf import settings

QR_CODE_CONTENT_TYPE = 'image/png'


def build_public_report_url(report) -> str:
    return f'{settings.FRONTEND_URL}/reports/{report.public_id}'


def generate_qr_png_data_url(value: str) -> str:
    qr_code = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr_code.add_data(value)
    qr_code.make(fit=True)

    image = qr_code.make_image(fill_color='black', back_color='white').convert('RGB')
    output = BytesIO()
    image.save(output, format='PNG')
    encoded_png = base64.b64encode(output.getvalue()).decode('ascii')
    return f'data:{QR_CODE_CONTENT_TYPE};base64,{encoded_png}'


def build_report_qr_code_payload(report) -> dict[str, str]:
    public_url = build_public_report_url(report)
    return {
        'public_url': public_url,
        'qr_code': generate_qr_png_data_url(public_url),
        'content_type': QR_CODE_CONTENT_TYPE,
    }
