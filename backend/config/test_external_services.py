import os
from unittest import skipUnless

from django.conf import settings
from django.core.mail import send_mail
from django.test import SimpleTestCase

from accounts.sso import verify_sso_token
from ai.services import generate_gemma_text
from maps.services import _build_overpass_query, _fetch_overpass


RUN_EXTERNAL_SMOKE_TESTS = os.getenv('RUN_EXTERNAL_SMOKE_TESTS') == '1'


@skipUnless(RUN_EXTERNAL_SMOKE_TESTS, 'External smoke tests are opt-in.')
class ExternalProviderSmokeTests(SimpleTestCase):
    def test_overpass_returns_json_elements(self):
        response = _fetch_overpass(
            _build_overpass_query(52.3676, 4.9041, 100),
        )

        self.assertIsInstance(response.get('elements'), list)

    @skipUnless(
        bool(os.getenv('DJANGO_GEMMA_API_KEY')),
        'A Gemma API key is required.',
    )
    def test_gemma_returns_generated_text(self):
        result = generate_gemma_text(
            prompt='Rewrite this factually: Black cat missing near the park.',
            fallback_text='Black cat missing near the park.',
        )

        self.assertTrue(result.generated_by_ai)
        self.assertTrue(result.text.strip())

    @skipUnless(
        bool(os.getenv('EXTERNAL_SMOKE_EMAIL_TO'))
        and 'smtp.EmailBackend' in os.getenv('DJANGO_EMAIL_BACKEND', ''),
        'SMTP backend and a smoke-test recipient are required.',
    )
    def test_smtp_accepts_transactional_email(self):
        delivered = send_mail(
            subject='CatSOS external smoke test',
            message='This message verifies the configured CatSOS SMTP transport.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[os.environ['EXTERNAL_SMOKE_EMAIL_TO']],
            fail_silently=False,
        )

        self.assertEqual(delivered, 1)

    @skipUnless(
        bool(os.getenv('EXTERNAL_SMOKE_SSO_PROVIDER'))
        and bool(os.getenv('EXTERNAL_SMOKE_SSO_TOKEN')),
        'An ephemeral provider token is required.',
    )
    def test_sso_provider_accepts_ephemeral_token(self):
        identity = verify_sso_token(
            provider=os.environ['EXTERNAL_SMOKE_SSO_PROVIDER'],
            token=os.environ['EXTERNAL_SMOKE_SSO_TOKEN'],
        )

        self.assertTrue(identity.provider_user_id)
        self.assertIn('@', identity.email)
