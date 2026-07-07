import base64
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport
from reports.services import create_report_photo

from .services import (
    POSTER_CONTENT_TYPE,
    build_report_poster_context,
    generate_report_poster_pdf,
)


class ReportArtifactApiTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self.other_user = get_user_model().objects.create_user(
            email='other@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self.media_root = tempfile.TemporaryDirectory()
        self.override_settings = override_settings(MEDIA_ROOT=self.media_root.name)
        self.override_settings.enable()
        self.addCleanup(self.override_settings.disable)
        self.addCleanup(self.media_root.cleanup)

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _create_report(self, **overrides):
        defaults = {
            'owner': self.owner,
            'cat_name': 'Luna',
            'coat_color': 'Black',
            'description': 'Likely hiding near gardens.',
            'last_seen_address': '12 Private Home Street',
            'last_seen_landmark': 'Near the playground',
            'contact_name': 'Marta Owner',
            'contact_phone': '+48 600 111 222',
            'contact_email': 'owner@example.com',
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(**defaults)

    def _create_image_file(self, name='cat.jpg', image_format='JPEG'):
        image = Image.new('RGB', (80, 80), color='black')
        output = BytesIO()
        image.save(output, format=image_format)
        return SimpleUploadedFile(
            name,
            output.getvalue(),
            content_type=f'image/{image_format.lower()}',
        )

    def _add_main_photo(self, report):
        return create_report_photo(
            report=report,
            image=self._create_image_file(),
            is_main=True,
        )

    def _qr_url(self, report):
        return reverse('report-qr-code', args=[report.id])

    def _poster_url(self, report):
        return reverse('report-poster', args=[report.id])

    def test_qr_code_generation_requires_authentication(self):
        report = self._create_report()

        response = self.client.post(self._qr_url(report), {}, format='json')

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    @override_settings(FRONTEND_URL='https://app.catsos.example')
    def test_owner_can_generate_qr_code_for_public_report(self):
        report = self._create_report()
        self._authenticate(self.owner)

        response = self.client.post(self._qr_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['public_url'],
            f'https://app.catsos.example/reports/{report.public_id}',
        )
        self.assertEqual(response.data['content_type'], 'image/png')
        self.assertTrue(response.data['qr_code'].startswith('data:image/png;base64,'))
        encoded_png = response.data['qr_code'].split(',', 1)[1]
        self.assertTrue(base64.b64decode(encoded_png).startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertNotIn('owner', response.data)
        self.assertNotIn('contact_email', response.data)
        self.assertNotIn('contact_phone', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_other_user_cannot_generate_qr_code_for_report(self):
        report = self._create_report()
        self._authenticate(self.other_user)

        response = self.client.post(self._qr_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_qr_code_generation_rejects_hidden_report(self):
        report = self._create_report(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        self._authenticate(self.owner)

        response = self.client.post(self._qr_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('report', response.data)

    def test_poster_generation_requires_authentication(self):
        report = self._create_report()

        response = self.client.post(self._poster_url(report), {}, format='json')

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    @override_settings(FRONTEND_URL='https://app.catsos.example')
    def test_owner_can_generate_printable_pdf_poster(self):
        report = self._create_report(
            contact_visibility=LostCatReport.ContactVisibility.PUBLIC,
        )
        self._add_main_photo(report)
        self._authenticate(self.owner)

        response = self.client.post(self._poster_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], POSTER_CONTENT_TYPE)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertIn(
            'attachment; filename="luna-poster.pdf"',
            response['Content-Disposition'],
        )
        self.assertTrue(response.content.startswith(b'%PDF-'))
        self.assertIn(b'/MediaBox', response.content)
        self.assertGreaterEqual(response.content.count(b'/Subtype /Image'), 2)

    def test_poster_generation_works_without_photo(self):
        report = self._create_report()
        self._authenticate(self.owner)

        response = self.client.post(self._poster_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b'%PDF-'))
        self.assertGreaterEqual(response.content.count(b'/Subtype /Image'), 1)

    def test_other_user_cannot_generate_poster_for_report(self):
        report = self._create_report()
        self._authenticate(self.other_user)

        response = self.client.post(self._poster_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_poster_generation_rejects_hidden_report(self):
        report = self._create_report(
            moderation_status=LostCatReport.ModerationStatus.HIDDEN,
        )
        self._authenticate(self.owner)

        response = self.client.post(self._poster_url(report), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('report', response.data)

    @override_settings(FRONTEND_URL='https://app.catsos.example')
    def test_poster_context_uses_public_contact_when_selected(self):
        report = self._create_report(
            contact_visibility=LostCatReport.ContactVisibility.PUBLIC,
        )

        context = build_report_poster_context(report)

        contact_text = '\n'.join(context['contact_lines'])
        self.assertIn('Marta Owner', contact_text)
        self.assertIn('+48 600 111 222', contact_text)
        self.assertIn('owner@example.com', contact_text)
        self.assertEqual(context['location_summary'], 'Near the playground')
        self.assertEqual(
            context['public_url'],
            f'https://app.catsos.example/reports/{report.public_id}',
        )

    def test_poster_context_hides_private_contact_and_exact_address(self):
        report = self._create_report(
            contact_visibility=LostCatReport.ContactVisibility.PRIVATE,
            last_seen_address='12 Private Home Street',
            last_seen_landmark='',
            last_seen_lat=52.2297,
            last_seen_lng=21.0122,
        )

        context = build_report_poster_context(report)

        contact_text = '\n'.join(context['contact_lines'])
        self.assertNotIn('+48 600 111 222', contact_text)
        self.assertNotIn('owner@example.com', contact_text)
        self.assertNotIn('12 Private Home Street', context['location_summary'])
        self.assertEqual(
            context['location_summary'],
            'Approximate map location available on the public report page.',
        )

    def test_poster_pdf_generation_returns_a4_pdf_bytes(self):
        report = self._create_report(cat_name='Łódź Luna')

        pdf_bytes = generate_report_poster_pdf(report)

        self.assertTrue(pdf_bytes.startswith(b'%PDF-'))
        self.assertIn(b'/MediaBox', pdf_bytes)
