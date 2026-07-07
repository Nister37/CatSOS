from .languages import get_user_preferred_language, normalize_preferred_language


ACCOUNT_EMAIL_TEMPLATES = {
    'en': {
        'verification_code': {
            'subject': 'Your CatSOS verification code',
            'message': 'Your CatSOS verification code is {code}.',
        },
        'password_reset_link': {
            'subject': 'Reset your CatSOS password',
            'message': (
                'Use this link to reset your CatSOS password:\n\n'
                '{reset_link}\n\n'
                'If you did not request this, you can ignore this email.'
            ),
        },
        'password_reset_confirmation': {
            'subject': 'Your CatSOS password was reset',
            'message': (
                'Your CatSOS password was reset successfully. '
                'If this was not you, contact support immediately.'
            ),
        },
        'password_change_confirmation': {
            'subject': 'Your CatSOS password was changed',
            'message': (
                'Your CatSOS password was changed successfully. '
                'If this was not you, contact support immediately.'
            ),
        },
    },
    'pl': {
        'verification_code': {
            'subject': 'Kod weryfikacyjny CatSOS',
            'message': 'Twój kod weryfikacyjny CatSOS to {code}.',
        },
        'password_reset_link': {
            'subject': 'Zresetuj hasło CatSOS',
            'message': (
                'Użyj tego linku, aby zresetować hasło CatSOS:\n\n'
                '{reset_link}\n\n'
                'Jeśli to nie Ty prosisz o zmianę, zignoruj tę wiadomość.'
            ),
        },
        'password_reset_confirmation': {
            'subject': 'Hasło CatSOS zostało zresetowane',
            'message': (
                'Hasło CatSOS zostało pomyślnie zresetowane. '
                'Jeśli to nie Ty, natychmiast skontaktuj się z pomocą techniczną.'
            ),
        },
        'password_change_confirmation': {
            'subject': 'Hasło CatSOS zostało zmienione',
            'message': (
                'Hasło CatSOS zostało pomyślnie zmienione. '
                'Jeśli to nie Ty, natychmiast skontaktuj się z pomocą techniczną.'
            ),
        },
    },
    'nl': {
        'verification_code': {
            'subject': 'Je CatSOS-verificatiecode',
            'message': 'Je CatSOS-verificatiecode is {code}.',
        },
        'password_reset_link': {
            'subject': 'Reset je CatSOS-wachtwoord',
            'message': (
                'Gebruik deze link om je CatSOS-wachtwoord te resetten:\n\n'
                '{reset_link}\n\n'
                'Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.'
            ),
        },
        'password_reset_confirmation': {
            'subject': 'Je CatSOS-wachtwoord is gereset',
            'message': (
                'Je CatSOS-wachtwoord is succesvol gereset. '
                'Neem direct contact op met support als jij dit niet was.'
            ),
        },
        'password_change_confirmation': {
            'subject': 'Je CatSOS-wachtwoord is gewijzigd',
            'message': (
                'Je CatSOS-wachtwoord is succesvol gewijzigd. '
                'Neem direct contact op met support als jij dit niet was.'
            ),
        },
    },
}


def render_account_email(template_name, *, user=None, language=None, **context):
    if language is None:
        language = get_user_preferred_language(user)

    language = normalize_preferred_language(language)
    template = ACCOUNT_EMAIL_TEMPLATES.get(language, ACCOUNT_EMAIL_TEMPLATES['en']).get(
        template_name
    )
    if template is None:
        template = ACCOUNT_EMAIL_TEMPLATES['en'][template_name]

    return (
        template['subject'].format(**context),
        template['message'].format(**context),
    )
