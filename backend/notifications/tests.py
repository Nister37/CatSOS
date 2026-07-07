from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.services import create_token_pair
from reports.models import LostCatReport
from sightings.models import Sighting
from test_constants import TEST_USER_PASSWORD

from .models import InAppNotification
from .services import (
    create_report_created_in_app_notification,
    create_report_status_changed_in_app_notification,
    create_sighting_created_in_app_notification,
    create_sighting_verification_in_app_notification,
    notify_owner_about_report_created,
    notify_owner_about_report_status_changed,
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
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.helper = get_user_model().objects.create_user(
            email='helper@example.com',
            password=TEST_USER_PASSWORD,
            display_name='Helpful Anna',
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

    def test_creates_report_created_in_app_notification_when_push_enabled(self):
        report = self._create_report(notify_push=True)

        notification = create_report_created_in_app_notification(
            report=report,
            actor=self.owner,
        )

        self.assertIsNotNone(notification)
        self.assertEqual(notification.recipient, self.owner)
        self.assertEqual(notification.actor, self.owner)
        self.assertEqual(notification.report, report)
        self.assertEqual(
            notification.event_type,
            InAppNotification.EventType.REPORT_CREATED,
        )
        self.assertEqual(notification.action_url, f'/my-reports/{report.id}')
        self.assertFalse(notification.is_read)

    def test_skips_report_created_in_app_notification_when_push_disabled(self):
        report = self._create_report(notify_push=False)

        notification = create_report_created_in_app_notification(report=report)

        self.assertIsNone(notification)
        self.assertFalse(InAppNotification.objects.exists())

    def test_creates_report_status_changed_in_app_notification(self):
        report = self._create_report(notify_push=True)

        notification = create_report_status_changed_in_app_notification(
            report=report,
            old_status=LostCatReport.Status.MISSING,
            new_status=LostCatReport.Status.FOUND,
            actor=self.owner,
        )

        self.assertEqual(notification.recipient, self.owner)
        self.assertEqual(
            notification.event_type,
            InAppNotification.EventType.REPORT_STATUS_CHANGED,
        )
        self.assertEqual(notification.title, 'Status changed for Luna')
        self.assertIn('Missing changed to Found', notification.message)

    def test_creates_sighting_in_app_notification_without_email_enabled(self):
        report = self._create_report(notify_email=False, notify_push=True)
        sighting = self._create_sighting(report)

        notification = create_sighting_created_in_app_notification(sighting=sighting)

        self.assertEqual(notification.recipient, self.owner)
        self.assertEqual(notification.actor, self.helper)
        self.assertEqual(notification.sighting, sighting)
        self.assertEqual(
            notification.event_type,
            InAppNotification.EventType.SIGHTING_CREATED,
        )
        self.assertNotIn('helper@example.com', notification.message)
        self.assertNotIn('Private helper note', notification.message)

    def test_skips_sighting_in_app_notification_when_owner_submits_sighting(self):
        report = self._create_report(notify_push=True)
        sighting = self._create_sighting(report, submitted_by=self.owner)

        notification = create_sighting_created_in_app_notification(sighting=sighting)

        self.assertIsNone(notification)
        self.assertFalse(InAppNotification.objects.exists())

    def test_creates_sighting_verification_in_app_notification_for_helper(self):
        report = self._create_report()
        sighting = self._create_sighting(report)
        sighting.verification_status = Sighting.VerificationStatus.USEFUL
        sighting.save(update_fields=('verification_status',))

        notification = create_sighting_verification_in_app_notification(
            sighting=sighting,
            actor=self.owner,
        )

        self.assertEqual(notification.recipient, self.helper)
        self.assertEqual(notification.actor, self.owner)
        self.assertEqual(
            notification.event_type,
            InAppNotification.EventType.SIGHTING_MARKED_USEFUL,
        )
        self.assertEqual(notification.action_url, f'/my-reports/{report.id}')

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

    def test_report_creation_email_uses_owner_preferred_language(self):
        self.owner.preferred_language = 'pl'
        self.owner.save(update_fields=('preferred_language',))
        report = self._create_report(has_microchip=True, chip_number='private-chip-123')

        sent = notify_owner_about_report_created(report=report)

        self.assertTrue(sent)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'Raport CatSOS dla Luna jest opublikowany')
        self.assertIn('Link do publicznego raportu', email.body)
        self.assertNotIn('12 Private Home Street', email.body)
        self.assertNotIn('private-chip-123', email.body)
        self.assertNotIn('+48 600 111 222', email.body)
        self.assertNotIn('owner@example.com', email.body)

    def test_skips_report_creation_email_when_account_preference_disabled(self):
        self.owner.notify_report_created_email = False
        self.owner.save(update_fields=('notify_report_created_email',))
        report = self._create_report()

        sent = notify_owner_about_report_created(report=report)

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

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

    def test_sends_owner_email_for_report_status_change_when_enabled(self):
        report = self._create_report(
            notify_email=True,
            has_microchip=True,
            chip_number='private-chip-123',
        )

        sent = notify_owner_about_report_status_changed(
            report=report,
            old_status=LostCatReport.Status.MISSING,
            new_status=LostCatReport.Status.FOUND,
        )

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, ['owner@example.com'])
        self.assertEqual(email.subject, 'CatSOS report status changed for Luna')
        self.assertIn('Luna', email.body)
        self.assertIn('Missing', email.body)
        self.assertIn('Found', email.body)
        self.assertIn(
            f'https://app.catsos.example/reports/{report.public_id}',
            email.body,
        )
        self.assertNotIn('12 Private Home Street', email.body)
        self.assertNotIn('private-chip-123', email.body)
        self.assertNotIn('+48 600 111 222', email.body)
        self.assertNotIn('owner@example.com', email.body)

    def test_report_status_email_uses_localized_status_labels(self):
        self.owner.preferred_language = 'nl'
        self.owner.save(update_fields=('preferred_language',))
        report = self._create_report(notify_email=True)

        sent = notify_owner_about_report_status_changed(
            report=report,
            old_status=LostCatReport.Status.MISSING,
            new_status=LostCatReport.Status.RECENTLY_SEEN,
        )

        self.assertTrue(sent)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'CatSOS-meldingsstatus gewijzigd voor Luna')
        self.assertIn('Vermist', email.body)
        self.assertIn('Recent gezien', email.body)
        self.assertIn(
            f'https://app.catsos.example/reports/{report.public_id}',
            email.body,
        )
        self.assertNotIn('12 Private Home Street', email.body)
        self.assertNotIn('owner@example.com', email.body)

    def test_skips_report_status_email_when_report_email_notifications_disabled(self):
        report = self._create_report(notify_email=False)

        sent = notify_owner_about_report_status_changed(
            report=report,
            old_status=LostCatReport.Status.MISSING,
            new_status=LostCatReport.Status.FOUND,
        )

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

    def test_skips_report_status_email_when_account_preference_disabled(self):
        self.owner.notify_report_status_changed_email = False
        self.owner.save(update_fields=('notify_report_status_changed_email',))
        report = self._create_report(notify_email=True)

        sent = notify_owner_about_report_status_changed(
            report=report,
            old_status=LostCatReport.Status.MISSING,
            new_status=LostCatReport.Status.FOUND,
        )

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

    def test_report_status_email_backend_failure_is_logged_and_does_not_raise(self):
        report = self._create_report(notify_email=True)

        with (
            patch(
                'notifications.services.send_mail',
                side_effect=RuntimeError('SMTP down'),
            ),
            self.assertLogs('notifications.services', level='ERROR') as logs,
        ):
            sent = notify_owner_about_report_status_changed(
                report=report,
                old_status=LostCatReport.Status.MISSING,
                new_status=LostCatReport.Status.FOUND,
            )

        self.assertFalse(sent)
        self.assertIn(
            'Failed to send report status change notification email.',
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

    def test_sighting_email_uses_owner_preferred_language(self):
        self.owner.preferred_language = 'pl'
        self.owner.save(update_fields=('preferred_language',))
        report = self._create_report()
        sighting = self._create_sighting(report)

        sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertTrue(sent)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'Nowa obserwacja kota Luna')
        self.assertIn('Lokalizacja: Behind the bakery', email.body)
        self.assertIn('Pewność: Wysoka', email.body)
        self.assertNotIn('helper@example.com', email.body)
        self.assertNotIn('Private helper note', email.body)

    def test_notification_email_falls_back_to_english_for_unsupported_language(self):
        self.owner.preferred_language = 'de'
        self.owner.save(update_fields=('preferred_language',))
        report = self._create_report()

        sent = notify_owner_about_report_created(report=report)

        self.assertTrue(sent)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'CatSOS report published for Luna')
        self.assertIn('Public report link', email.body)

    def test_skips_email_when_report_email_notifications_disabled(self):
        report = self._create_report(notify_email=False)
        sighting = self._create_sighting(report)

        sent = notify_owner_about_sighting_created(sighting=sighting)

        self.assertFalse(sent)
        self.assertEqual(mail.outbox, [])

    def test_skips_sighting_email_when_account_preference_disabled(self):
        self.owner.notify_sighting_created_email = False
        self.owner.save(update_fields=('notify_sighting_created_email',))
        report = self._create_report(notify_email=True)
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


class InAppNotificationApiTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.helper = get_user_model().objects.create_user(
            email='helper@example.com',
            password=TEST_USER_PASSWORD,
            display_name='Helpful Anna',
            is_email_verified=True,
        )
        self.other_user = get_user_model().objects.create_user(
            email='other@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )

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
            'notify_email': False,
            'notify_push': True,
        }
        defaults.update(overrides)
        return LostCatReport.objects.create(**defaults)

    def _sighting_payload(self, **overrides):
        payload = {
            'seen_at': timezone.now().isoformat(),
            'location_description': 'Behind the bakery',
            'latitude': 52.2297,
            'longitude': 21.0122,
            'confidence': Sighting.Confidence.HIGH,
            'notes': 'Private helper note with helper@example.com',
        }
        payload.update(overrides)
        return payload

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

    def _create_notification(self, **overrides):
        report = overrides.pop('report', self._create_report())
        defaults = {
            'recipient': self.owner,
            'actor': self.helper,
            'report': report,
            'event_type': InAppNotification.EventType.SIGHTING_CREATED,
            'title': 'New sighting for Luna',
            'message': 'A logged-in helper submitted a new sighting.',
            'action_url': f'/my-reports/{report.id}',
        }
        defaults.update(overrides)
        return InAppNotification.objects.create(**defaults)

    def test_owner_can_list_recent_notification_after_sighting_submission(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        self._authenticate(self.helper)

        with self.captureOnCommitCallbacks(execute=True):
            create_response = self.client.post(
                reverse('public-report-sighting-create', args=[report.public_id]),
                self._sighting_payload(),
                format='json',
            )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self._authenticate(self.owner)

        response = self.client.get(reverse('notification-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        notification = response.data['results'][0]
        self.assertEqual(
            notification['event_type'],
            InAppNotification.EventType.SIGHTING_CREATED,
        )
        self.assertEqual(notification['action_url'], f'/my-reports/{report.id}')
        self.assertEqual(notification['report']['id'], str(report.id))
        self.assertEqual(notification['report']['public_id'], str(report.public_id))
        self.assertEqual(notification['report']['cat_name'], 'Luna')
        self.assertEqual(notification['sighting']['id'], str(report.sightings.get().id))
        self.assertEqual(
            notification['sighting']['location_description'],
            'Behind the bakery',
        )
        self.assertEqual(notification['sighting']['confidence'], Sighting.Confidence.HIGH)
        self.assertEqual(
            notification['sighting']['verification_status'],
            Sighting.VerificationStatus.PENDING,
        )
        self.assertEqual(notification['actor']['display_name'], 'Helpful Anna')
        self.assertEqual(notification['actor']['avatar_fallback'], 'HA')
        response_text = str(response.data)
        self.assertNotIn('helper@example.com', response_text)
        self.assertNotIn('Private helper note', response_text)
        self.assertNotIn('12 Private Home Street', response_text)
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_only_recipient_can_list_and_mark_notification_read(self):
        notification = self._create_notification()
        self._authenticate(self.helper)

        list_response = self.client.get(reverse('notification-list'))
        read_response = self.client.patch(
            reverse('notification-read', args=[notification.id]),
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], 0)
        self.assertEqual(read_response.status_code, status.HTTP_404_NOT_FOUND)

        self._authenticate(self.owner)
        owner_response = self.client.patch(
            reverse('notification-read', args=[notification.id]),
            format='json',
        )

        self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
        self.assertTrue(owner_response.data['is_read'])
        self.assertIsNotNone(owner_response.data['read_at'])
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_unread_filter_returns_matching_notifications(self):
        unread_notification = self._create_notification(title='Unread update')
        read_notification = self._create_notification(title='Read update')
        read_notification.is_read = True
        read_notification.read_at = timezone.now()
        read_notification.save(update_fields=('is_read', 'read_at'))
        self._authenticate(self.owner)

        unread_response = self.client.get(reverse('notification-list'), {'unread': 'true'})
        read_response = self.client.get(reverse('notification-list'), {'unread': 'false'})
        invalid_response = self.client.get(reverse('notification-list'), {'unread': 'maybe'})

        self.assertEqual(unread_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unread_response.data['count'], 1)
        self.assertEqual(
            unread_response.data['results'][0]['id'],
            str(unread_notification.id),
        )
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data['count'], 1)
        self.assertEqual(
            read_response.data['results'][0]['id'],
            str(read_notification.id),
        )
        self.assertEqual(invalid_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unread', invalid_response.data)

    def test_sighting_verification_creates_helper_notification_after_commit(self):
        report = self._create_report(status=LostCatReport.Status.MISSING)
        sighting = self._create_sighting(report)
        self._authenticate(self.owner)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                reverse('report-sighting-verification', args=[report.id, sighting.id]),
                {'verification_status': Sighting.VerificationStatus.USEFUL},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self._authenticate(self.helper)
        notification_response = self.client.get(reverse('notification-list'))

        self.assertEqual(notification_response.status_code, status.HTTP_200_OK)
        self.assertEqual(notification_response.data['count'], 1)
        notification = notification_response.data['results'][0]
        self.assertEqual(
            notification['event_type'],
            InAppNotification.EventType.SIGHTING_MARKED_USEFUL,
        )
        self.assertEqual(notification['title'], 'Your sighting was marked useful')
        self.assertEqual(notification['report']['id'], str(report.id))
        self.assertEqual(notification['report']['public_id'], str(report.public_id))
        self.assertEqual(notification['sighting']['id'], str(sighting.id))
        self.assertEqual(notification['actor']['display_name'], 'CatSOS user')


class NotificationApiAuthorizationTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(
            email='owner@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )
        self.other_user = get_user_model().objects.create_user(
            email='other@example.com',
            password=TEST_USER_PASSWORD,
            is_email_verified=True,
        )

    def _authenticate(self, user):
        tokens = create_token_pair(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def _create_notification(self, recipient, **overrides):
        defaults = {
            'recipient': recipient,
            'event_type': InAppNotification.EventType.REPORT_CREATED,
            'title': 'Test notification',
            'message': 'Test message',
        }
        defaults.update(overrides)
        return InAppNotification.objects.create(**defaults)

    def test_notification_list_requires_authentication(self):
        response = self.client.get(reverse('notification-list'))

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_user_cannot_read_other_users_notifications(self):
        notification = self._create_notification(self.owner)
        self._authenticate(self.other_user)

        response = self.client.get(reverse('notification-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

    def test_mark_read_requires_authentication(self):
        notification = self._create_notification(self.owner)

        response = self.client.patch(
            reverse('notification-read', args=[notification.id]),
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_user_cannot_mark_other_users_notification_read(self):
        notification = self._create_notification(self.owner)
        self._authenticate(self.other_user)

        response = self.client.patch(
            reverse('notification-read', args=[notification.id]),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        notification.refresh_from_db()
        self.assertFalse(notification.is_read)
