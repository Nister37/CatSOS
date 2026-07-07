from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
import requests
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair

from .services import (
    GemmaClient,
    generate_gemma_text,
    improve_lost_cat_description,
    sanitize_text_for_ai,
)


class GemmaServiceTests(TestCase):
    @override_settings(GEMMA_ENABLED=False, GEMMA_API_KEY='')
    @patch('ai.services.requests.post')
    def test_generate_gemma_text_returns_fallback_when_disabled(self, mock_post):
        result = generate_gemma_text(
            prompt='Improve this text.',
            fallback_text='Original text.',
        )

        self.assertEqual(result.text, 'Original text.')
        self.assertFalse(result.generated_by_ai)
        self.assertIn('disabled', result.error)
        mock_post.assert_not_called()

    @override_settings(GEMMA_ENABLED=True, GEMMA_API_KEY='')
    @patch('ai.services.requests.post')
    def test_generate_gemma_text_returns_fallback_when_key_missing(self, mock_post):
        result = generate_gemma_text(
            prompt='Improve this text.',
            fallback_text='Original text.',
        )

        self.assertEqual(result.text, 'Original text.')
        self.assertFalse(result.generated_by_ai)
        mock_post.assert_not_called()

    @override_settings(
        GEMMA_ENABLED=True,
        GEMMA_API_KEY='test-api-key',
        GEMMA_API_BASE_URL='https://gemma.example.test/v1beta',
        GEMMA_MODEL='gemma-test',
        GEMMA_TIMEOUT_SECONDS=2.5,
        GEMMA_TEMPERATURE=0.1,
        GEMMA_MAX_OUTPUT_TOKENS=128,
    )
    @patch('ai.services.requests.post')
    def test_generate_gemma_text_calls_generate_content_api(self, mock_post):
        response = Mock()
        response.json.return_value = {
            'candidates': [
                {
                    'content': {
                        'parts': [
                            {'text': 'Improved text.'},
                        ],
                    },
                },
            ],
        }
        mock_post.return_value = response

        result = generate_gemma_text(
            prompt='Rough text.',
            fallback_text='Rough text.',
            system_instruction='Do not invent facts.',
        )

        self.assertEqual(result.text, 'Improved text.')
        self.assertTrue(result.generated_by_ai)
        mock_post.assert_called_once()
        _args, kwargs = mock_post.call_args
        self.assertEqual(
            mock_post.call_args.args[0],
            'https://gemma.example.test/v1beta/models/gemma-test:generateContent',
        )
        self.assertEqual(kwargs['params'], {'key': 'test-api-key'})
        self.assertEqual(kwargs['timeout'], 2.5)
        self.assertEqual(
            kwargs['json']['contents'],
            [{'role': 'user', 'parts': [{'text': 'Rough text.'}]}],
        )
        self.assertEqual(
            kwargs['json']['systemInstruction'],
            {'parts': [{'text': 'Do not invent facts.'}]},
        )
        self.assertEqual(
            kwargs['json']['generationConfig'],
            {'temperature': 0.1, 'maxOutputTokens': 128},
        )

    @override_settings(
        GEMMA_ENABLED=True,
        GEMMA_API_KEY='test-api-key',
    )
    @patch('ai.services.requests.post')
    def test_generate_gemma_text_returns_fallback_on_timeout(self, mock_post):
        mock_post.side_effect = requests.Timeout()

        with self.assertLogs('ai.services', level='WARNING') as logs:
            result = generate_gemma_text(
                prompt='Private prompt should not be logged.',
                fallback_text='Fallback.',
            )

        self.assertEqual(result.text, 'Fallback.')
        self.assertFalse(result.generated_by_ai)
        self.assertEqual(result.error, 'Gemma generation failed.')
        self.assertIn('Gemma generation failed', logs.output[0])
        self.assertNotIn('Private prompt', logs.output[0])
        self.assertNotIn('test-api-key', logs.output[0])

    @override_settings(
        GEMMA_ENABLED=True,
        GEMMA_API_KEY='test-api-key',
    )
    def test_gemma_client_rejects_response_without_text(self):
        client = GemmaClient()

        with self.assertRaisesMessage(Exception, 'text output'):
            client._extract_text({'candidates': [{'content': {'parts': []}}]})


class DescriptionImproveServiceTests(TestCase):
    def test_sanitize_text_for_ai_removes_private_contact_details(self):
        sanitized = sanitize_text_for_ai(
            'Mila disappeared from 123 Private Street. '
            'Call +48 600 111 222 or owner@example.com.'
        )

        self.assertIn('[address removed]', sanitized)
        self.assertIn('[phone removed]', sanitized)
        self.assertIn('[email removed]', sanitized)
        self.assertNotIn('123 Private Street', sanitized)
        self.assertNotIn('+48 600 111 222', sanitized)
        self.assertNotIn('owner@example.com', sanitized)

    def test_improve_description_sends_sanitized_prompt_only(self):
        class CaptureClient:
            prompt = ''
            system_instruction = ''

            def generate_text(self, *, prompt, system_instruction=''):
                self.prompt = prompt
                self.system_instruction = system_instruction
                return 'Mila is a shy black cat. She may be hiding near gardens.'

        client = CaptureClient()

        result = improve_lost_cat_description(
            description=(
                'Mila is a shy black cat. Call +48 600 111 222. '
                'She disappeared from 123 Private Street.'
            ),
            client=client,
        )

        self.assertTrue(result['generated_by_ai'])
        self.assertTrue(result['requires_review'])
        self.assertEqual(
            result['suggestion'],
            'Mila is a shy black cat. She may be hiding near gardens.',
        )
        self.assertIn('Do not invent', client.system_instruction)
        self.assertNotIn('+48 600 111 222', client.prompt)
        self.assertNotIn('123 Private Street', client.prompt)
        self.assertIn('[phone removed]', client.prompt)
        self.assertIn('[address removed]', client.prompt)

    @override_settings(GEMMA_ENABLED=False, GEMMA_API_KEY='')
    def test_improve_description_falls_back_to_original_when_disabled(self):
        result = improve_lost_cat_description(
            description='Mila is a shy black cat who may hide under cars.',
        )

        self.assertEqual(
            result['suggestion'],
            'Mila is a shy black cat who may hide under cars.',
        )
        self.assertFalse(result['generated_by_ai'])
        self.assertTrue(result['requires_review'])
        self.assertIn('disabled', result['fallback_reason'])


class DescriptionImproveApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='owner@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

    def _authenticate(self):
        tokens = create_token_pair(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _url(self):
        return reverse('ai-improve-description')

    def test_improve_description_requires_authentication(self):
        response = self.client.post(
            self._url(),
            {'description': 'Mila is a shy black cat.'},
            format='json',
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_improve_description_rejects_too_short_text(self):
        self._authenticate()

        response = self.client.post(
            self._url(),
            {'description': 'short'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('description', response.data)

    @override_settings(
        GEMMA_ENABLED=True,
        GEMMA_API_KEY='test-api-key',
        GEMMA_API_BASE_URL='https://gemma.example.test/v1beta',
        GEMMA_MODEL='gemma-test',
    )
    @patch('ai.services.requests.post')
    def test_improve_description_returns_reviewable_ai_suggestion(self, mock_post):
        self._authenticate()
        response = Mock()
        response.json.return_value = {
            'candidates': [
                {'content': {'parts': [{'text': 'Mila is a shy black cat.'}]}},
            ],
        }
        mock_post.return_value = response

        api_response = self.client.post(
            self._url(),
            {
                'description': (
                    'Mila is a shy black cat. Call +48 600 111 222 or '
                    'email owner@example.com. Last seen at 123 Private Street.'
                )
            },
            format='json',
        )

        self.assertEqual(api_response.status_code, status.HTTP_200_OK)
        self.assertEqual(api_response['Cache-Control'], 'no-store')
        self.assertEqual(api_response.data['suggestion'], 'Mila is a shy black cat.')
        self.assertTrue(api_response.data['generated_by_ai'])
        self.assertTrue(api_response.data['requires_review'])
        self.assertEqual(api_response.data['fallback_reason'], '')
        self.assertIn('Review the suggestion', api_response.data['privacy_notice'])

        prompt = mock_post.call_args.kwargs['json']['contents'][0]['parts'][0]['text']
        self.assertNotIn('+48 600 111 222', prompt)
        self.assertNotIn('owner@example.com', prompt)
        self.assertNotIn('123 Private Street', prompt)
        self.assertIn('[phone removed]', prompt)
        self.assertIn('[email removed]', prompt)
        self.assertIn('[address removed]', prompt)

    @override_settings(GEMMA_ENABLED=False, GEMMA_API_KEY='')
    @patch('ai.services.requests.post')
    def test_improve_description_falls_back_without_provider_call(self, mock_post):
        self._authenticate()

        response = self.client.post(
            self._url(),
            {'description': 'Mila is a shy black cat who may hide under cars.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['suggestion'],
            'Mila is a shy black cat who may hide under cars.',
        )
        self.assertFalse(response.data['generated_by_ai'])
        self.assertTrue(response.data['requires_review'])
        mock_post.assert_not_called()
