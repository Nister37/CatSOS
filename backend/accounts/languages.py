from django.db import models


class PreferredLanguage(models.TextChoices):
    ENGLISH = 'en', 'English'
    POLISH = 'pl', 'Polish'
    DUTCH = 'nl', 'Dutch'


DEFAULT_PREFERRED_LANGUAGE = PreferredLanguage.ENGLISH


def normalize_preferred_language(value) -> str:
    code = str(value or '').strip().lower().replace('_', '-')
    if '-' in code:
        code = code.split('-', 1)[0]

    if code in PreferredLanguage.values:
        return code

    return DEFAULT_PREFERRED_LANGUAGE


def get_user_preferred_language(user) -> str:
    return normalize_preferred_language(
        getattr(user, 'preferred_language', DEFAULT_PREFERRED_LANGUAGE)
    )
