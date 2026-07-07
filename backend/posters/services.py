import base64
from io import BytesIO
from pathlib import Path
from textwrap import shorten

import qrcode
import reportlab
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from reports.models import LostCatReport

QR_CODE_CONTENT_TYPE = 'image/png'
POSTER_CONTENT_TYPE = 'application/pdf'
POSTER_FONT_NAME = 'CatsosVera'
POSTER_BOLD_FONT_NAME = 'CatsosVeraBold'
POSTER_DESCRIPTION_MAX_LENGTH = 420
POSTER_LOCATION_FALLBACK = 'Scan the QR code for location updates.'


def build_public_report_url(report) -> str:
    return f'{settings.FRONTEND_URL}/reports/{report.public_id}'


def generate_qr_image(value: str):
    qr_code = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr_code.add_data(value)
    qr_code.make(fit=True)
    return qr_code.make_image(fill_color='black', back_color='white').convert('RGB')


def generate_qr_png_bytes(value: str) -> bytes:
    output = BytesIO()
    generate_qr_image(value).save(output, format='PNG')
    return output.getvalue()


def generate_qr_png_data_url(value: str) -> str:
    encoded_png = base64.b64encode(generate_qr_png_bytes(value)).decode('ascii')
    return f'data:{QR_CODE_CONTENT_TYPE};base64,{encoded_png}'


def build_report_qr_code_payload(report) -> dict[str, str]:
    public_url = build_public_report_url(report)
    return {
        'public_url': public_url,
        'qr_code': generate_qr_png_data_url(public_url),
        'content_type': QR_CODE_CONTENT_TYPE,
    }


def register_poster_fonts():
    fonts_path = Path(reportlab.__file__).resolve().parent / 'fonts'
    try:
        pdfmetrics.getFont(POSTER_FONT_NAME)
    except KeyError:
        pdfmetrics.registerFont(TTFont(POSTER_FONT_NAME, str(fonts_path / 'Vera.ttf')))

    try:
        pdfmetrics.getFont(POSTER_BOLD_FONT_NAME)
    except KeyError:
        pdfmetrics.registerFont(
            TTFont(POSTER_BOLD_FONT_NAME, str(fonts_path / 'VeraBd.ttf'))
        )


def clean_poster_text(value) -> str:
    return ' '.join(str(value or '').split())


def truncate_poster_text(value, max_length) -> str:
    value = clean_poster_text(value)
    if len(value) <= max_length:
        return value
    return shorten(value, width=max_length, placeholder='...')


def get_report_main_photo(report):
    photos = list(report.photos.all())
    main_photo = next((photo for photo in photos if photo.is_main), None)
    if main_photo is not None:
        return main_photo
    return photos[0] if photos else None


def read_report_photo_bytes(report) -> bytes | None:
    photo = get_report_main_photo(report)
    if photo is None or not photo.image:
        return None

    try:
        photo.image.open('rb')
        try:
            return photo.image.read()
        finally:
            photo.image.close()
    except (OSError, ValueError):
        return None


def build_poster_location_summary(report) -> str:
    if report.last_seen_landmark:
        return clean_poster_text(report.last_seen_landmark)

    if report.last_seen_lat is not None and report.last_seen_lng is not None:
        return 'Approximate map location available on the public report page.'

    return POSTER_LOCATION_FALLBACK


def build_poster_contact_lines(report) -> list[str]:
    if report.contact_visibility == LostCatReport.ContactVisibility.PUBLIC:
        lines = ['Public contact selected by owner:']
        if report.contact_name:
            lines.append(f'Name: {clean_poster_text(report.contact_name)}')
        if report.contact_phone:
            lines.append(f'Phone: {clean_poster_text(report.contact_phone)}')
        if report.contact_email:
            lines.append(f'Email: {clean_poster_text(report.contact_email)}')
        return lines

    if report.contact_visibility == LostCatReport.ContactVisibility.APP_ONLY:
        return [
            'Log in to CatSOS from the QR page to submit a sighting.',
            'Direct owner contact details are hidden on this poster.',
        ]

    return [
        'Scan the QR code to view the public report and submit a sighting.',
        'The owner chose not to publish direct contact details.',
    ]


def build_report_poster_context(report) -> dict:
    public_url = build_public_report_url(report)
    reward = ''
    if report.reward_amount is not None:
        reward = f'Reward: {report.reward_amount}'
        if report.reward_note:
            reward = f'{reward} - {clean_poster_text(report.reward_note)}'
    elif report.reward_note:
        reward = f'Reward note: {clean_poster_text(report.reward_note)}'

    return {
        'public_url': public_url,
        'cat_name': clean_poster_text(report.cat_name),
        'status': clean_poster_text(report.get_status_display()),
        'description': truncate_poster_text(
            report.description,
            POSTER_DESCRIPTION_MAX_LENGTH,
        ),
        'location_summary': build_poster_location_summary(report),
        'contact_lines': build_poster_contact_lines(report),
        'reward': reward,
        'qr_code': generate_qr_png_bytes(public_url),
        'photo': read_report_photo_bytes(report),
    }


def _draw_wrapped_text(
    pdf,
    text,
    *,
    x,
    y,
    max_width,
    font_name=POSTER_FONT_NAME,
    font_size=12,
    leading=15,
    max_lines=None,
):
    pdf.setFont(font_name, font_size)
    lines = simpleSplit(clean_poster_text(text), font_name, font_size, max_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = truncate_poster_text(lines[-1], max(len(lines[-1]) - 3, 12))

    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading

    return y


def _draw_image_box(pdf, image_bytes, *, x, y_top, width, height, label):
    y = y_top - height
    pdf.setStrokeColor(colors.HexColor('#d0d5dd'))
    pdf.setLineWidth(1)
    pdf.rect(x, y, width, height, stroke=True, fill=False)

    if image_bytes:
        try:
            image = ImageReader(BytesIO(image_bytes))
            pdf.drawImage(
                image,
                x,
                y,
                width=width,
                height=height,
                preserveAspectRatio=True,
                anchor='c',
                mask='auto',
            )
            return
        except OSError:
            pass

    pdf.setFillColor(colors.HexColor('#667085'))
    pdf.setFont(POSTER_FONT_NAME, 12)
    pdf.drawCentredString(x + width / 2, y + height / 2, label)
    pdf.setFillColor(colors.black)


def generate_report_poster_pdf(report) -> bytes:
    register_poster_fonts()
    context = build_report_poster_context(report)
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=0)
    page_width, page_height = A4
    margin = 18 * mm
    content_width = page_width - (2 * margin)

    pdf.setTitle(f"Lost cat poster - {context['cat_name']}")
    pdf.setFillColor(colors.HexColor('#b42318'))
    pdf.setFont(POSTER_BOLD_FONT_NAME, 34)
    pdf.drawCentredString(page_width / 2, page_height - 35 * mm, 'MISSING CAT')

    pdf.setFillColor(colors.black)
    pdf.setFont(POSTER_BOLD_FONT_NAME, 26)
    pdf.drawCentredString(page_width / 2, page_height - 49 * mm, context['cat_name'])

    photo_top = page_height - 64 * mm
    photo_width = 86 * mm
    photo_height = 86 * mm
    _draw_image_box(
        pdf,
        context['photo'],
        x=margin,
        y_top=photo_top,
        width=photo_width,
        height=photo_height,
        label='Photo unavailable',
    )

    info_x = margin + photo_width + 12 * mm
    info_width = page_width - margin - info_x
    info_y = photo_top - 6 * mm
    pdf.setFillColor(colors.HexColor('#344054'))
    pdf.setFont(POSTER_BOLD_FONT_NAME, 12)
    pdf.drawString(info_x, info_y, f"Status: {context['status']}")
    info_y -= 11 * mm

    pdf.setFillColor(colors.black)
    pdf.setFont(POSTER_BOLD_FONT_NAME, 12)
    pdf.drawString(info_x, info_y, 'Last known location')
    info_y -= 6 * mm
    info_y = _draw_wrapped_text(
        pdf,
        context['location_summary'],
        x=info_x,
        y=info_y,
        max_width=info_width,
        font_size=11,
        leading=14,
        max_lines=3,
    )
    info_y -= 5 * mm

    pdf.setFont(POSTER_BOLD_FONT_NAME, 12)
    pdf.drawString(info_x, info_y, 'Description')
    info_y -= 6 * mm
    _draw_wrapped_text(
        pdf,
        context['description'],
        x=info_x,
        y=info_y,
        max_width=info_width,
        font_size=10,
        leading=13,
        max_lines=9,
    )

    details_top = photo_top - photo_height - 16 * mm
    pdf.setFillColor(colors.HexColor('#101828'))
    pdf.setFont(POSTER_BOLD_FONT_NAME, 15)
    pdf.drawString(margin, details_top, 'How to help')
    details_y = details_top - 8 * mm

    for contact_line in context['contact_lines']:
        details_y = _draw_wrapped_text(
            pdf,
            contact_line,
            x=margin,
            y=details_y,
            max_width=content_width - 58 * mm,
            font_size=11,
            leading=14,
            max_lines=2,
        )

    if context['reward']:
        details_y -= 3 * mm
        _draw_wrapped_text(
            pdf,
            context['reward'],
            x=margin,
            y=details_y,
            max_width=content_width - 58 * mm,
            font_name=POSTER_BOLD_FONT_NAME,
            font_size=11,
            leading=14,
            max_lines=2,
        )

    qr_size = 43 * mm
    qr_x = page_width - margin - qr_size
    qr_y = 34 * mm
    _draw_image_box(
        pdf,
        context['qr_code'],
        x=qr_x,
        y_top=qr_y + qr_size,
        width=qr_size,
        height=qr_size,
        label='QR unavailable',
    )

    pdf.setFont(POSTER_BOLD_FONT_NAME, 11)
    pdf.drawString(margin, 62 * mm, 'Scan for live updates')
    _draw_wrapped_text(
        pdf,
        context['public_url'],
        x=margin,
        y=55 * mm,
        max_width=content_width - qr_size - 12 * mm,
        font_size=9,
        leading=11,
        max_lines=3,
    )

    pdf.setFillColor(colors.HexColor('#667085'))
    pdf.setFont(POSTER_FONT_NAME, 8)
    pdf.drawString(
        margin,
        15 * mm,
        'CatSOS public poster - verify details on the QR-linked report page.',
    )

    pdf.showPage()
    pdf.save()
    return output.getvalue()
