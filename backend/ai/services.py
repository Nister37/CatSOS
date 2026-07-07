from dataclasses import dataclass
import logging

from django.conf import settings
import requests

logger = logging.getLogger(__name__)


class AIServiceDisabled(Exception):
    pass


class AIServiceError(Exception):
    pass


@dataclass(frozen=True)
class AITextResult:
    text: str
    generated_by_ai: bool
    error: str = ''


class GemmaClient:
    def __init__(
            self,
            *,
            api_key=None,
            api_base_url=None,
            model=None,
            timeout_seconds=None,
    ):
        self.api_key = api_key if api_key is not None else settings.GEMMA_API_KEY
        self.api_base_url = (
            api_base_url if api_base_url is not None else settings.GEMMA_API_BASE_URL
        ).rstrip('/')
        self.model = model if model is not None else settings.GEMMA_MODEL
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.GEMMA_TIMEOUT_SECONDS
        )

    def is_configured(self):
        return bool(settings.GEMMA_ENABLED and self.api_key and self.api_base_url and self.model)

    def generate_text(self, *, prompt, system_instruction=''):
        if not self.is_configured():
            raise AIServiceDisabled('Gemma integration is disabled or not configured.')

        response = self._post_generate_content(
            self._build_payload(
                prompt=prompt,
                system_instruction=system_instruction,
            )
        )
        return self._extract_text(response)

    def _build_payload(self, *, prompt, system_instruction=''):
        payload = {
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': prompt}],
                },
            ],
            'generationConfig': {
                'temperature': settings.GEMMA_TEMPERATURE,
                'maxOutputTokens': settings.GEMMA_MAX_OUTPUT_TOKENS,
            },
        }
        if system_instruction:
            payload['systemInstruction'] = {
                'parts': [{'text': system_instruction}],
            }
        return payload

    def _post_generate_content(self, payload):
        url = f'{self.api_base_url}/models/{self.model}:generateContent'
        try:
            response = requests.post(
                url,
                params={'key': self.api_key},
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except requests.Timeout as exc:
            raise AIServiceError('Gemma request timed out.') from exc
        except requests.RequestException as exc:
            raise AIServiceError('Gemma request failed.') from exc

        try:
            return response.json()
        except ValueError as exc:
            raise AIServiceError('Gemma response was not valid JSON.') from exc

    def _extract_text(self, response_data):
        candidates = response_data.get('candidates')
        if not isinstance(candidates, list):
            raise AIServiceError('Gemma response did not include candidates.')

        text_parts = []
        for candidate in candidates:
            content = candidate.get('content') if isinstance(candidate, dict) else None
            parts = content.get('parts') if isinstance(content, dict) else None
            if not isinstance(parts, list):
                continue
            for part in parts:
                if not isinstance(part, dict):
                    continue
                text = part.get('text')
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())

        text = '\n'.join(text_parts).strip()
        if not text:
            raise AIServiceError('Gemma response did not include text output.')
        return text


def generate_gemma_text(*, prompt, fallback_text='', system_instruction='', client=None):
    gemma_client = client or GemmaClient()
    try:
        return AITextResult(
            text=gemma_client.generate_text(
                prompt=prompt,
                system_instruction=system_instruction,
            ),
            generated_by_ai=True,
        )
    except AIServiceDisabled as exc:
        return AITextResult(
            text=fallback_text,
            generated_by_ai=False,
            error=str(exc),
        )
    except AIServiceError as exc:
        logger.warning('Gemma generation failed: %s', exc)
        return AITextResult(
            text=fallback_text,
            generated_by_ai=False,
            error='Gemma generation failed.',
        )
