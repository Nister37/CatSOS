from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from reports.management.commands.seed_demo_data import DEMO_PASSWORD, DEMO_USER_EMAILS
from reports.models import LostCatReport, LostCatReportTimelineEvent


class SeedDemoDataCommandTests(TestCase):
    def _call_command(self, **options):
        output = StringIO()
        call_command('seed_demo_data', stdout=output, **options)
        return output.getvalue()

    @override_settings(DEBUG=True)
    def test_seed_creates_demo_users_and_reports(self):
        output = self._call_command()

        self.assertIn('Seeded 3 demo users and 3 demo reports.', output)

        User = get_user_model()
        owner = User.objects.get(email='owner.demo@catsos.local')
        helper = User.objects.get(email='helper.demo@catsos.local')
        admin = User.objects.get(email='admin.demo@catsos.local')

        self.assertEqual(owner.display_name, 'Marta Kowalska')
        self.assertTrue(owner.is_email_verified)
        self.assertFalse(owner.is_staff)
        self.assertTrue(owner.check_password(DEMO_PASSWORD))
        self.assertEqual(helper.contribution_points, 180)
        self.assertIn('Helpful spotter', helper.public_badges)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

        reports = LostCatReport.objects.order_by('cat_name')
        self.assertEqual(reports.count(), 3)
        self.assertEqual(
            {report.cat_name for report in reports},
            {'Luna', 'Miso', 'Pixel'},
        )
        self.assertEqual(
            reports.filter(
                moderation_status=LostCatReport.ModerationStatus.APPROVED,
            ).count(),
            3,
        )

        luna = reports.get(cat_name='Luna')
        self.assertEqual(luna.owner, owner)
        self.assertEqual(luna.status, LostCatReport.Status.MISSING)
        self.assertEqual(
            luna.public_summary,
            'Shy black cat with a white chest patch, last seen near Jordan Park.',
        )
        self.assertEqual(
            luna.contact_visibility,
            LostCatReport.ContactVisibility.APP_ONLY,
        )

        miso = reports.get(cat_name='Miso')
        self.assertEqual(miso.status, LostCatReport.Status.FOUND)
        self.assertIsNotNone(miso.resolved_at)
        self.assertIn('safely home', miso.found_message)

        self.assertEqual(LostCatReportTimelineEvent.objects.count(), 3)
        self.assertEqual(
            set(
                LostCatReportTimelineEvent.objects.values_list(
                    'event_type',
                    flat=True,
                )
            ),
            {LostCatReportTimelineEvent.EventType.REPORT_CREATED},
        )

    @override_settings(DEBUG=True)
    def test_seed_is_idempotent(self):
        self._call_command()
        first_report_ids = set(
            LostCatReport.objects.values_list('id', flat=True),
        )
        first_user_ids = set(
            get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).values_list(
                'id',
                flat=True,
            )
        )

        self._call_command()

        self.assertEqual(
            get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).count(),
            3,
        )
        self.assertEqual(LostCatReport.objects.count(), 3)
        self.assertEqual(LostCatReportTimelineEvent.objects.count(), 3)
        self.assertEqual(
            set(LostCatReport.objects.values_list('id', flat=True)),
            first_report_ids,
        )
        self.assertEqual(
            set(
                get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).values_list(
                    'id',
                    flat=True,
                )
            ),
            first_user_ids,
        )

    @override_settings(DEBUG=True)
    def test_reset_recreates_demo_data(self):
        self._call_command()
        original_luna_id = LostCatReport.objects.get(cat_name='Luna').id

        self._call_command(reset=True)

        self.assertFalse(LostCatReport.objects.filter(id=original_luna_id).exists())
        self.assertEqual(
            get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).count(),
            3,
        )
        self.assertEqual(LostCatReport.objects.count(), 3)
        self.assertEqual(LostCatReportTimelineEvent.objects.count(), 3)

    @override_settings(DEBUG=False)
    def test_refuses_non_debug_without_explicit_production_flag(self):
        with self.assertRaisesMessage(CommandError, 'Refusing to seed demo data'):
            self._call_command()

        self.assertFalse(get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).exists())

    @override_settings(DEBUG=False)
    def test_refuses_default_password_in_non_debug_even_when_allowed(self):
        with self.assertRaisesMessage(CommandError, 'default password'):
            self._call_command(allow_production=True)

        self.assertFalse(get_user_model().objects.filter(email__in=DEMO_USER_EMAILS).exists())

    @override_settings(DEBUG=False)
    def test_allows_non_debug_with_explicit_password_and_flag(self):
        self._call_command(
            allow_production=True,
            password='DisposableDemoPassword123!',
        )

        admin = get_user_model().objects.get(email='admin.demo@catsos.local')
        self.assertTrue(admin.check_password('DisposableDemoPassword123!'))
