from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from reports.models import LostCatReport, LostCatReportTimelineEvent
from sightings.models import Sighting


DEMO_HELPER_EMAIL = 'helper.demo@catsos.local'


@dataclass(frozen=True)
class DemoSightingDefinition:
    """Definition for a realistic demo sighting."""

    cat_name: str
    location_description: str
    latitude: float
    longitude: float
    confidence: str
    notes: str
    days_ago: float
    verification_status: str = Sighting.VerificationStatus.PENDING


DEMO_SIGHTINGS = (
    # Sightings for 'Luna' (MISSING report near Jordan Park, Krakow)
    DemoSightingDefinition(
        cat_name='Luna',
        location_description='Behind Biedronka on ul. Lea, near recycling bins',
        latitude=50.0638,
        longitude=19.9201,
        confidence=Sighting.Confidence.MEDIUM,
        notes=(
            'Saw a small black cat with a white chest patch hiding under '
            'the recycling bins. Tried to approach but she ran into the bushes.'
        ),
        days_ago=1.5,
    ),
    DemoSightingDefinition(
        cat_name='Luna',
        location_description='Jordan Park south entrance, near the playground',
        latitude=50.0611,
        longitude=19.9176,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Definitely matches the photo. Sat on a bench and she came closer '
            'when I shook my keys. Red collar visible.'
        ),
        days_ago=0.8,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
    DemoSightingDefinition(
        cat_name='Luna',
        location_description='Stairwell entrance, ul. Reymonta 15',
        latitude=50.0645,
        longitude=19.9160,
        confidence=Sighting.Confidence.LOW,
        notes='Heard meowing from a basement window. Could not see the cat clearly.',
        days_ago=3.2,
        verification_status=Sighting.VerificationStatus.FALSE,
    ),
    # Sightings for 'Pixel' (RECENTLY_SEEN report near Vistula river)
    DemoSightingDefinition(
        cat_name='Pixel',
        location_description='Vistula riverside path, near Dębnicki bridge',
        latitude=50.0489,
        longitude=19.9352,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Large grey tabby walking calmly along the path. Fluffy tail, '
            'no collar visible. Responded when I said "Pixel" softly.'
        ),
        days_ago=2.0,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
    DemoSightingDefinition(
        cat_name='Pixel',
        location_description='Courtyard of apartment block, ul. Tyniecka 8',
        latitude=50.0466,
        longitude=19.9310,
        confidence=Sighting.Confidence.MEDIUM,
        notes=(
            'A large grey cat was sleeping on a car roof. Looks like '
            'a Maine Coon mix. Left some food nearby.'
        ),
        days_ago=4.5,
    ),
    DemoSightingDefinition(
        cat_name='Pixel',
        location_description='Garden area behind Manggha Museum',
        latitude=50.0482,
        longitude=19.9398,
        confidence=Sighting.Confidence.LOW,
        notes='Saw a grey cat crossing the road quickly. Not 100% sure it was the same one.',
        days_ago=7.0,
    ),
    # Sightings for 'Miso' (FOUND report - these are historical sightings)
    DemoSightingDefinition(
        cat_name='Miso',
        location_description='Kleparz market hall back alley',
        latitude=50.0720,
        longitude=19.9425,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Small cream-and-ginger cat hiding behind crates. Very timid, '
            'ran when I approached. Matches the poster exactly.'
        ),
        days_ago=10.0,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
    DemoSightingDefinition(
        cat_name='Miso',
        location_description='Courtyard behind grocery shop, ul. Basztowa',
        latitude=50.0713,
        longitude=19.9417,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Found the cat sitting in the courtyard. Matches description. '
            'Called the owner through the app. Cat safely recovered!'
        ),
        days_ago=9.0,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
)


class Command(BaseCommand):
    help = (
        'Seed realistic demo sightings across existing demo reports. '
        'Requires seed_demo_data to be run first.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing demo sightings before seeding.',
        )
        parser.add_argument(
            '--allow-production',
            action='store_true',
            help='Allow seeding when DEBUG=False. Intended only for disposable demo environments.',
        )

    def handle(self, *args, **options):
        self._validate_environment(allow_production=options['allow_production'])

        User = get_user_model()
        helper = User.objects.filter(email=DEMO_HELPER_EMAIL).first()
        if helper is None:
            raise CommandError(
                f'Demo helper user ({DEMO_HELPER_EMAIL}) not found. '
                'Run seed_demo_data first.'
            )

        owner_email = 'owner.demo@catsos.local'
        owner = User.objects.filter(email=owner_email).first()
        if owner is None:
            raise CommandError(
                f'Demo owner user ({owner_email}) not found. '
                'Run seed_demo_data first.'
            )

        reports = self._get_demo_reports(owner=owner)
        if not reports:
            raise CommandError(
                'No demo reports found for the demo owner. '
                'Run seed_demo_data first.'
            )

        with transaction.atomic():
            if options['reset']:
                self._reset_demo_sightings(helper=helper)

            sightings = self._seed_sightings(
                helper=helper,
                owner=owner,
                reports=reports,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {len(sightings)} demo sightings across '
                f'{len(reports)} demo reports.'
            )
        )

    def _validate_environment(self, *, allow_production):
        if settings.DEBUG:
            return
        if not allow_production:
            raise CommandError(
                'Refusing to seed demo data when DEBUG=False. '
                'Pass --allow-production only for disposable demo environments.'
            )

    def _get_demo_reports(self, *, owner):
        return {
            report.cat_name: report
            for report in LostCatReport.objects.filter(owner=owner)
        }

    def _reset_demo_sightings(self, *, helper):
        deleted_count, _ = Sighting.objects.filter(submitted_by=helper).delete()
        if deleted_count:
            self.stdout.write(f'Deleted {deleted_count} existing demo sightings.')

    def _seed_sightings(self, *, helper, owner, reports):
        now = timezone.now()
        created_sightings = []

        for definition in DEMO_SIGHTINGS:
            report = reports.get(definition.cat_name)
            if report is None:
                self.stderr.write(
                    self.style.WARNING(
                        f'Report for "{definition.cat_name}" not found, skipping sighting.'
                    )
                )
                continue

            seen_at = now - timedelta(days=definition.days_ago)

            sighting, created = Sighting.objects.get_or_create(
                report=report,
                submitted_by=helper,
                location_description=definition.location_description,
                defaults={
                    'seen_at': seen_at,
                    'latitude': definition.latitude,
                    'longitude': definition.longitude,
                    'confidence': definition.confidence,
                    'notes': definition.notes,
                    'verification_status': definition.verification_status,
                    'verified_by': owner
                    if definition.verification_status != Sighting.VerificationStatus.PENDING
                    else None,
                    'verified_at': now - timedelta(days=definition.days_ago - 0.1)
                    if definition.verification_status != Sighting.VerificationStatus.PENDING
                    else None,
                },
            )

            if created:
                self._ensure_sighting_timeline_event(
                    report=report,
                    sighting=sighting,
                    helper=helper,
                )

            created_sightings.append(sighting)

        return created_sightings

    def _ensure_sighting_timeline_event(self, *, report, sighting, helper):
        LostCatReportTimelineEvent.objects.get_or_create(
            report=report,
            event_type=LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
            actor=helper,
            location_summary=sighting.location_description,
            defaults={},
        )
