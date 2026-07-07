from dataclasses import dataclass
import logging
import re

from django.conf import settings
import requests

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
PHONE_PATTERN = re.compile(r'\+?\d[\d\s().-]{7,}\d')
STREET_ADDRESS_PATTERN = re.compile(
    r'\b\d{1,5}\s+'
    r'[\w\s.\'-]{2,80}'
    r'\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|'
    r'boulevard|blvd\.?|court|ct\.?|place|pl\.?)\b'
    r'(?:\s+[\w\s.\'-]{0,40})?',
    re.IGNORECASE,
)
DESCRIPTION_CLEANUP_SYSTEM_INSTRUCTION = (
    'You improve lost-cat report descriptions. Use only facts present in the '
    'user text. Do not invent details, diagnoses, locations, contact details, '
    'reward terms, or sightings. Keep the result concise, factual, and suitable '
    'for a public lost-cat report. Return only the rewritten description.'
)
PUBLIC_SUMMARY_SYSTEM_INSTRUCTION = (
    'You write short public summaries for lost-cat reports. Use only facts '
    'provided by the user. Do not invent details, sightings, diagnoses, reward '
    'terms, exact addresses, or contact details. Keep the summary under 35 words '
    'and suitable for public report cards. Return only the summary.'
)
AI_PRIVACY_NOTICE = (
    'Private contact details are removed before AI processing. Review the '
    'suggestion before saving.'
)
PUBLIC_SUMMARY_MAX_LENGTH = 240
REDACTION_MARKER_PATTERN = re.compile(
    r'\[(?:email|phone|address) removed\]',
    re.IGNORECASE,
)


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


def _replace_phone_like_values(text):
    def replace_match(match):
        digits = [char for char in match.group(0) if char.isdigit()]
        if len(digits) < 9:
            return match.group(0)
        return '[phone removed]'

    return PHONE_PATTERN.sub(replace_match, text)


def sanitize_text_for_ai(text):
    sanitized = EMAIL_PATTERN.sub('[email removed]', text)
    sanitized = _replace_phone_like_values(sanitized)
    sanitized = STREET_ADDRESS_PATTERN.sub('[address removed]', sanitized)
    return sanitized.strip()


def _condense_text(text):
    return ' '.join(text.split())


def _truncate_summary(text, *, max_length=PUBLIC_SUMMARY_MAX_LENGTH):
    text = _condense_text(text)
    if len(text) <= max_length:
        return text

    truncated = text[: max_length - 3].rsplit(' ', 1)[0].strip()
    return f'{truncated}...'


def sanitize_public_summary_text(text):
    sanitized = sanitize_text_for_ai(text)
    sanitized = REDACTION_MARKER_PATTERN.sub('', sanitized)
    return _truncate_summary(sanitized)


def build_public_summary_fallback(description):
    return sanitize_public_summary_text(description)


def improve_lost_cat_description(*, description, client=None):
    sanitized_description = sanitize_text_for_ai(description)
    prompt = (
        'Rewrite this lost-cat report description using only the facts below. '
        'Do not add facts. Do not include contact details.\n\n'
        f'{sanitized_description}'
    )
    result = generate_gemma_text(
        prompt=prompt,
        fallback_text=description.strip(),
        system_instruction=DESCRIPTION_CLEANUP_SYSTEM_INSTRUCTION,
        client=client,
    )
    return {
        'suggestion': result.text,
        'generated_by_ai': result.generated_by_ai,
        'requires_review': True,
        'fallback_reason': result.error,
        'privacy_notice': AI_PRIVACY_NOTICE,
    }


def generate_public_report_summary(
    *,
    description,
    cat_name='',
    coat_color='',
    personality='',
    last_seen_landmark='',
    client=None,
):
    fact_lines = []
    for label, value in (
        ('Cat name', cat_name),
        ('Coat color', coat_color),
        ('Personality', personality),
        ('Public landmark', last_seen_landmark),
        ('Description', description),
    ):
        sanitized_value = sanitize_text_for_ai(value)
        if sanitized_value:
            fact_lines.append(f'{label}: {sanitized_value}')

    fallback_summary = build_public_summary_fallback(description)
    prompt = (
        'Create one short public lost-cat summary from these facts. '
        'Use only these facts. Do not include contact details or exact addresses.\n\n'
        + '\n'.join(fact_lines)
    )
    result = generate_gemma_text(
        prompt=prompt,
        fallback_text=fallback_summary,
        system_instruction=PUBLIC_SUMMARY_SYSTEM_INSTRUCTION,
        client=client,
    )
    suggestion = sanitize_public_summary_text(result.text) or fallback_summary
    return {
        'suggestion': suggestion,
        'generated_by_ai': result.generated_by_ai,
        'requires_review': True,
        'fallback_reason': result.error,
        'privacy_notice': AI_PRIVACY_NOTICE,
    }
