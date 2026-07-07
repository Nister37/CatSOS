import json
import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase


BACKEND_DIR = Path(__file__).resolve().parents[1]
INSECURE_DEVELOPMENT_SECRET_KEY = (
    'django-insecure-q76^mha&@(ovynxbrpx70f#8+u#p*ei&1t^5p%=5gqlfldokfc'
)


def run_settings_import(script, env_overrides):
    env = os.environ.copy()
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, '-c', script],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


class ProductionSettingsSecurityTests(SimpleTestCase):
    def test_production_rejects_development_secret_key(self):
        result = run_settings_import(
            'import config.settings',
            {
                'DJANGO_DEBUG': 'false',
                'DJANGO_SECRET_KEY': INSECURE_DEVELOPMENT_SECRET_KEY,
            },
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn('DJANGO_SECRET_KEY must be set', result.stderr)

    def test_production_security_defaults_are_enabled(self):
        script = """
import json
import config.settings as settings
print(json.dumps({
    "SESSION_COOKIE_SECURE": settings.SESSION_COOKIE_SECURE,
    "CSRF_COOKIE_SECURE": settings.CSRF_COOKIE_SECURE,
    "SECURE_SSL_REDIRECT": settings.SECURE_SSL_REDIRECT,
    "SECURE_HSTS_SECONDS": settings.SECURE_HSTS_SECONDS,
    "SECURE_HSTS_INCLUDE_SUBDOMAINS": settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
    "SECURE_HSTS_PRELOAD": settings.SECURE_HSTS_PRELOAD,
    "SECURE_CONTENT_TYPE_NOSNIFF": settings.SECURE_CONTENT_TYPE_NOSNIFF,
    "X_FRAME_OPTIONS": settings.X_FRAME_OPTIONS,
    "REFERRER_POLICY": settings.REFERRER_POLICY,
}))
"""
        result = run_settings_import(
            script,
            {
                'DJANGO_DEBUG': 'false',
                'DJANGO_SECRET_KEY': 'test-production-secret-key',
            },
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        settings = json.loads(result.stdout)
        self.assertTrue(settings['SESSION_COOKIE_SECURE'])
        self.assertTrue(settings['CSRF_COOKIE_SECURE'])
        self.assertTrue(settings['SECURE_SSL_REDIRECT'])
        self.assertEqual(settings['SECURE_HSTS_SECONDS'], 31536000)
        self.assertTrue(settings['SECURE_HSTS_INCLUDE_SUBDOMAINS'])
        self.assertTrue(settings['SECURE_HSTS_PRELOAD'])
        self.assertTrue(settings['SECURE_CONTENT_TYPE_NOSNIFF'])
        self.assertEqual(settings['X_FRAME_OPTIONS'], 'DENY')
        self.assertEqual(settings['REFERRER_POLICY'], 'same-origin')
