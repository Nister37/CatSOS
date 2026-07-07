from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
import requests

from .services import GemmaClient, generate_gemma_text


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
