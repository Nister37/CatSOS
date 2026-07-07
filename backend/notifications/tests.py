from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from reports.models import LostCatReport
from sightings.models import Sighting

from .services import (
    notify_owner_about_report_created,
    notify_owner_about_sighting_created,
)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='https://app.catsos.example',
)
class NotificationServiceTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )
        self.helper = get_user_model().objects.create_user(
            email='helper@example.com',
            password='StrongPass123!',
            is_email_verified=True,
        )

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
            'notify_email': True,
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(**defaults)

    def _create_sighting(self, report, **overrides):
        defaults = {
            'report': report,
            'submitted_by': self.helper,
            'seen_at': timezone.now(),
            'location_description': 'Behind the bakery',
            'latitude': 52.2297,
            'longitude': 21.0122,
            'confidence': Sighting.Confidence.HIGH,
            'notes': 'Private helper note with helper@example.com',
        }
        defaults.update(overrides)
        return Sighting.objects.create(**defaults)

    def test_sends_owner_email_for_report_creation_confirmation(self):
        report = self._create_report(
            notify_email=False,
            has_microchip=True,
            chip_number='private-chip-123',
        )

        sent = notify_owner_about_report_created(report=report)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['owner@example.com'])
        self.assertEqual(email.subject, 'CatSOS report published for Luna')
        self.assertIn('Luna', email.body)
        self.assertIn(
            f'https://app.catsos.example/reports/{report.public_id}',
            email.body,
        )
        self.assertNotIn('12 Private Home Street', email.body)
        self.assertNotIn('private-chip-123', email.body)
        self.assertNotIn('+48 600 111 222', email.body)
        self.assertNotIn('owner@example.com', email.body)

    def test_report_creation_email_backend_failure_is_logged_and_does_not_raise(self):
        report = self._create_report()

        with (
            patch(
                'notifications.services.send_mail',
                side_effect=RuntimeError('SMTP down'),
            ),
            self.assertLogs('notifications.services', level='ERROR') as logs,
        ):
            sent = notify_owner_about_report_created(report=report)

        self.assertFalse(sent)
        self.assertIn(
            'Failed to send report creation confirmation email.',
            logs.output[0],
        )

    def test_sends_owner_email_for_new_sighting_when_enabled(self):
        report = self._create_report()
        sighting = self._create_sighting(report)

        sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['owner@example.com'])
        self.assertEqual(email.subject, 'New sighting for Luna')
        self.assertIn('Luna', email.body)
        self.assertIn('Behind the bakery', email.body)
        self.assertIn('High', email.body)
        self.assertIn(
            f'https://app.catsos.example/reports/{report.public_id}',
            email.body,
        )
        self.assertNotIn('helper@example.com', email.body)
        self.assertNotIn('Private helper note', email.body)

    def test_skips_email_when_report_email_notifications_disabled(self):
        report = self._create_report(notify_email=False)
        sighting = self._create_sighting(report)

        sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

    def test_skips_email_when_owner_submits_own_sighting(self):
        report = self._create_report()
        sighting = self._create_sighting(report, submitted_by=self.owner)

        sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

    def test_email_backend_failure_is_logged_and_does_not_raise(self):
        report = self._create_report()
        sighting = self._create_sighting(report)

        with (
            patch(
                'notifications.services.send_mail',
                side_effect=RuntimeError('SMTP down'),
            ),
            self.assertLogs('notifications.services', level='ERROR') as logs,
        ):
            sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertFalse(sent)
        self.assertIn('Failed to send sighting notification email.', logs.output[0])
