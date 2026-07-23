from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from notifications.models import InAppNotification
from reports.models import LostCatReport, LostCatReportTimelineEvent
from reports.services import build_report_location_summary
from sightings.models import Sighting


DEMO_PASSWORD = 'CatSOSDemo123!'

SCENARIO_OWNER_EMAIL = 'scenario.owner@catsos.local'
SCENARIO_HELPER_EMAIL = 'scenario.helper@catsos.local'


@dataclass(frozen=True)
class ScenarioUserDefinition:
    email: str
    display_name: str
    public_location: str
    public_bio: str
    contribution_points: int
    public_badges: list[str] = field(default_factory=list)
    is_staff: bool = False
    is_superuser: bool = False


@dataclass(frozen=True)
class ScenarioReportDefinition:
    cat_name: str
    age_years: int
    breed: str
    coat_color: str
    eye_color: str
    gender: str
    collar_description: str
    has_microchip: bool
    personality: str
    public_summary: str
    description: str
    last_seen_address: str
    last_seen_landmark: str
    last_seen_lat: float
    last_seen_lng: float
    reward_amount: Decimal | None
    reward_note: str
    contact_name: str
    contact_phone: str
    contact_email: str
    contact_visibility: str
    status: str
    days_missing: int
    found_message: str = ''


@dataclass(frozen=True)
class ScenarioSightingDefinition:
    cat_name: str
    location_description: str
    latitude: float
    longitude: float
    confidence: str
    notes: str
    days_ago: float
    verification_status: str = Sighting.VerificationStatus.PENDING


SCENARIO_USERS = (
    ScenarioUserDefinition(
        email=SCENARIO_OWNER_EMAIL,
        display_name='Anna Wiśniewska',
        public_location='Amsterdam, Netherlands',
        public_bio='Looking for my two cats after a move. Please help!',
        contribution_points=30,
        public_badges=['Owner'],
    ),
    ScenarioUserDefinition(
        email=SCENARIO_HELPER_EMAIL,
        display_name='Tom de Vries',
        public_location='Amsterdam, Netherlands',
        public_bio='Neighborhood volunteer, always keeping an eye out for lost pets.',
        contribution_points=85,
        public_badges=['Neighbor helper', 'First help'],
    ),
)

SCENARIO_REPORTS = (
    ScenarioReportDefinition(
        cat_name='Whiskers',
        age_years=6,
        breed='British Shorthair',
        coat_color='Blue-grey, dense plush coat',
        eye_color='Copper',
        gender=LostCatReport.Gender.MALE,
        collar_description='Green leather collar with bone-shaped tag',
        has_microchip=True,
        personality='Friendly and food-motivated. Enjoys chin scratches from strangers.',
        public_summary='Chunky blue-grey cat with copper eyes, friendly, last seen near Vondelpark.',
        description=(
            'Whiskers escaped through an open window during hot weather. '
            'He is an indoor cat but very curious about gardens. '
            'Likely hiding in dense hedges or under garden sheds.'
        ),
        last_seen_address='Vondelpark area, Amsterdam',
        last_seen_landmark='Near Vondelpark south entrance, close to the rose garden',
        last_seen_lat=52.3567,
        last_seen_lng=4.8668,
        reward_amount=Decimal('150.00'),
        reward_note='Reward for safe return or confirmed recovery lead.',
        contact_name='Anna Wiśniewska',
        contact_phone='+31 6 1234 5678',
        contact_email=SCENARIO_OWNER_EMAIL,
        contact_visibility=LostCatReport.ContactVisibility.APP_ONLY,
        status=LostCatReport.Status.RECENTLY_SEEN,
        days_missing=4,
    ),
    ScenarioReportDefinition(
        cat_name='Mochi',
        age_years=2,
        breed='Ragdoll mix',
        coat_color='Cream body with dark brown points (face, ears, paws, tail)',
        eye_color='Blue',
        gender=LostCatReport.Gender.FEMALE,
        collar_description='Pink breakaway collar, no tag',
        has_microchip=True,
        personality='Very shy and easily startled. Hides under furniture when stressed.',
        public_summary='Shy cream Ragdoll mix with blue eyes, missing near Jordaan.',
        description=(
            'Mochi slipped out when a plumber left the front door open. '
            'She is very timid and will not approach strangers. '
            'If spotted, please do not chase — just report location.'
        ),
        last_seen_address='Jordaan neighborhood, Amsterdam',
        last_seen_landmark='Near Noordermarkt, between houseboats on Prinsengracht',
        last_seen_lat=52.3800,
        last_seen_lng=4.8844,
        reward_amount=None,
        reward_note='',
        contact_name='Anna Wiśniewska',
        contact_phone='+31 6 1234 5678',
        contact_email=SCENARIO_OWNER_EMAIL,
        contact_visibility=LostCatReport.ContactVisibility.PUBLIC,
        status=LostCatReport.Status.MISSING,
        days_missing=1,
    ),
    ScenarioReportDefinition(
        cat_name='Felix',
        age_years=10,
        breed='Domestic longhair',
        coat_color='Black and white tuxedo pattern',
        eye_color='Green',
        gender=LostCatReport.Gender.MALE,
        collar_description='No collar (lost it during escape)',
        has_microchip=True,
        personality='Elderly, calm, slow-moving. Enjoys warm sunny spots.',
        public_summary='Senior tuxedo cat, found safe in a neighbor garden shed.',
        description=(
            'Felix was missing for 6 days but was found sleeping in a '
            "neighbor's garden shed three streets away. Thank you everyone!"
        ),
        last_seen_address='De Pijp neighborhood, Amsterdam',
        last_seen_landmark='Albert Cuyp Market area',
        last_seen_lat=52.3550,
        last_seen_lng=4.8920,
        reward_amount=Decimal('50.00'),
        reward_note='Thank-you treats delivered to the finder!',
        contact_name='Anna Wiśniewska',
        contact_phone='+31 6 1234 5678',
        contact_email=SCENARIO_OWNER_EMAIL,
        contact_visibility=LostCatReport.ContactVisibility.PRIVATE,
        status=LostCatReport.Status.FOUND,
        days_missing=8,
        found_message=(
            'Felix is home safe! He was found napping in a garden shed '
            'three streets away. Special thanks to Tom who spotted him '
            'through the CatSOS app. 🐱'
        ),
    ),
)

SCENARIO_SIGHTINGS = (
    # Sightings for Whiskers (RECENTLY_SEEN)
    ScenarioSightingDefinition(
        cat_name='Whiskers',
        location_description='Rose garden hedge, Vondelpark south',
        latitude=52.3562,
        longitude=4.8674,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Chunky blue-grey cat sitting under a hedge near the rose garden. '
            'Let me get within 2 meters before moving away. Green collar visible.'
        ),
        days_ago=2.0,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
    ScenarioSightingDefinition(
        cat_name='Whiskers',
        location_description='Back garden of Overtoom 280',
        latitude=52.3580,
        longitude=4.8700,
        confidence=Sighting.Confidence.MEDIUM,
        notes='Grey cat on a fence. Right color and size but could not see the collar.',
        days_ago=1.0,
    ),
    # Sighting for Felix (historical, before found)
    ScenarioSightingDefinition(
        cat_name='Felix',
        location_description='Garden shed, Govert Flinckstraat backyard',
        latitude=52.3545,
        longitude=4.8915,
        confidence=Sighting.Confidence.HIGH,
        notes=(
            'Found a black-and-white cat sleeping in my garden shed. '
            'Matches the poster description. Very calm, not scared.'
        ),
        days_ago=7.0,
        verification_status=Sighting.VerificationStatus.USEFUL,
    ),
)


class Command(BaseCommand):
    help = (
        'Seed a complete demo scenario: owner, helper, reports with different '
        'statuses, sightings, timeline events, and notifications. '
        'Ideal for demonstrating the full CatSOS owner flow.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=DEMO_PASSWORD,
            help='Password assigned to scenario demo accounts.',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing scenario demo data before seeding.',
        )
        parser.add_argument(
            '--allow-production',
            action='store_true',
            help='Allow seeding when DEBUG=False. Intended only for disposable demo environments.',
        )

    def handle(self, *args, **options):
        password = options['password']
        self._validate_environment(
            password=password,
            allow_production=options['allow_production'],
        )

        with transaction.atomic():
            if options['reset']:
                self._reset_scenario_data()

            users = self._seed_users(password=password)
            owner = users[SCENARIO_OWNER_EMAIL]
            helper = users[SCENARIO_HELPER_EMAIL]

            reports = self._seed_reports(owner=owner)
            sightings = self._seed_sightings(
                helper=helper,
                owner=owner,
                reports=reports,
            )
            notifications = self._seed_notifications(
                owner=owner,
                helper=helper,
                reports=reports,
                sightings=sightings,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Demo scenario seeded: '
                f'{len(users)} users, '
                f'{len(reports)} reports, '
                f'{len(sightings)} sightings, '
                f'{len(notifications)} notifications.'
            )
        )
        self.stdout.write(
            f'Owner login: {SCENARIO_OWNER_EMAIL} / {password}'
        )
        self.stdout.write(
            f'Helper login: {SCENARIO_HELPER_EMAIL} / {password}'
        )

    def _validate_environment(self, *, password, allow_production):
        if settings.DEBUG:
            return
        if not allow_production:
            raise CommandError(
                'Refusing to seed demo data when DEBUG=False. '
                'Pass --allow-production only for disposable demo environments.'
            )
        if password == DEMO_PASSWORD:
            raise CommandError(
                'Refusing to create demo accounts with the default password '
                'when DEBUG=False.'
            )

    def _reset_scenario_data(self):
        User = get_user_model()
        deleted_count, _ = User.objects.filter(
            email__in=(SCENARIO_OWNER_EMAIL, SCENARIO_HELPER_EMAIL),
        ).delete()
        if deleted_count:
            self.stdout.write(f'Deleted {deleted_count} existing scenario users (cascade).')

    def _seed_users(self, *, password):
        User = get_user_model()
        users = {}

        for definition in SCENARIO_USERS:
            user, _created = User.objects.get_or_create(email=definition.email)
            user.display_name = definition.display_name
            user.public_location = definition.public_location
            user.public_bio = definition.public_bio
            user.contribution_points = definition.contribution_points
            user.public_badges = definition.public_badges
            user.is_staff = definition.is_staff
            user.is_superuser = definition.is_superuser
            user.is_active = True
            user.is_email_verified = True
            user.email_verification_code_hash = ''
            user.email_verification_sent_at = None
            if user.email_verified_at is None:
                user.email_verified_at = timezone.now()
            user.set_password(password)
            user.save(
                update_fields=(
                    'password',
                    'display_name',
                    'public_location',
                    'public_bio',
                    'contribution_points',
                    'public_badges',
                    'is_staff',
                    'is_superuser',
                    'is_active',
                    'is_email_verified',
                    'email_verification_code_hash',
                    'email_verification_sent_at',
                    'email_verified_at',
                ),
            )
            users[user.email] = user

        return users

    def _seed_reports(self, *, owner):
        reports = {}
        now = timezone.now()

        for definition in SCENARIO_REPORTS:
            resolved_at = None
            if definition.status in {
                LostCatReport.Status.FOUND,
                LostCatReport.Status.CLOSED,
            }:
                resolved_at = now - timedelta(days=1)

            report, _created = LostCatReport.objects.update_or_create(
                owner=owner,
                cat_name=definition.cat_name,
                defaults={
                    'age_years': definition.age_years,
                    'breed': definition.breed,
                    'coat_color': definition.coat_color,
                    'eye_color': definition.eye_color,
                    'gender': definition.gender,
                    'collar_description': definition.collar_description,
                    'has_microchip': definition.has_microchip,
                    'chip_number': 'DEMO-SCENARIO-CHIP'
                    if definition.has_microchip
                    else '',
                    'personality': definition.personality,
                    'public_summary': definition.public_summary,
                    'description': definition.description,
                    'disappeared_at': now - timedelta(days=definition.days_missing),
                    'last_seen_address': definition.last_seen_address,
                    'last_seen_landmark': definition.last_seen_landmark,
                    'last_seen_lat': definition.last_seen_lat,
                    'last_seen_lng': definition.last_seen_lng,
                    'reward_amount': definition.reward_amount,
                    'reward_note': definition.reward_note,
                    'contact_name': definition.contact_name,
                    'contact_phone': definition.contact_phone,
                    'contact_email': definition.contact_email,
                    'contact_visibility': definition.contact_visibility,
                    'notify_push': True,
                    'notify_sms': False,
                    'notify_email': True,
                    'status': definition.status,
                    'found_message': definition.found_message,
                    'resolved_at': resolved_at,
                    'moderation_status': LostCatReport.ModerationStatus.APPROVED,
                    'moderation_notes': '',
                },
            )
            self._ensure_report_timeline(report=report, owner=owner)
            reports[definition.cat_name] = report

        return reports

    def _ensure_report_timeline(self, *, report, owner):
        """Create report lifecycle timeline events."""
        # REPORT_CREATED event
        LostCatReportTimelineEvent.objects.get_or_create(
            report=report,
            event_type=LostCatReportTimelineEvent.EventType.REPORT_CREATED,
            defaults={
                'actor': owner,
                'location_summary': build_report_location_summary(report),
            },
        )

        # STATUS_CHANGED event for non-MISSING reports
        if report.status != LostCatReport.Status.MISSING:
            if report.status == LostCatReport.Status.RECENTLY_SEEN:
                from_status = LostCatReport.Status.MISSING
            elif report.status == LostCatReport.Status.FOUND:
                from_status = LostCatReport.Status.RECENTLY_SEEN
            else:
                from_status = LostCatReport.Status.MISSING

            LostCatReportTimelineEvent.objects.get_or_create(
                report=report,
                event_type=LostCatReportTimelineEvent.EventType.STATUS_CHANGED,
                to_status=report.status,
                defaults={
                    'actor': owner,
                    'from_status': from_status,
                    'location_summary': build_report_location_summary(report),
                },
            )

    def _seed_sightings(self, *, helper, owner, reports):
        now = timezone.now()
        created_sightings = []

        for definition in SCENARIO_SIGHTINGS:
            report = reports.get(definition.cat_name)
            if report is None:
                self.stderr.write(
                    self.style.WARNING(
                        f'Report for "{definition.cat_name}" not found, skipping.'
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
                # Timeline event for sighting
                LostCatReportTimelineEvent.objects.get_or_create(
                    report=report,
                    event_type=LostCatReportTimelineEvent.EventType.SIGHTING_CREATED,
                    actor=helper,
                    location_summary=definition.location_description,
                    defaults={},
                )

                # Timeline event for useful verification
                if definition.verification_status == Sighting.VerificationStatus.USEFUL:
                    LostCatReportTimelineEvent.objects.get_or_create(
                        report=report,
                        event_type=LostCatReportTimelineEvent.EventType.SIGHTING_MARKED_USEFUL,
                        actor=owner,
                        location_summary=definition.location_description,
                        defaults={},
                    )

            created_sightings.append(sighting)

        return created_sightings

    def _seed_notifications(self, *, owner, helper, reports, sightings):
        """Create realistic in-app notifications for the demo scenario."""
        notifications = []
        now = timezone.now()

        # Notification: report created (for owner confirmation)
        for cat_name, report in reports.items():
            notification, created = InAppNotification.objects.get_or_create(
                recipient=owner,
                report=report,
                event_type=InAppNotification.EventType.REPORT_CREATED,
                defaults={
                    'actor': owner,
                    'title': f'Report created: {cat_name}',
                    'message': f'Your report for {cat_name} is now live and visible to helpers.',
                    'action_url': f'/reports/{report.public_id}',
                    'is_read': report.status == LostCatReport.Status.FOUND,
                    'read_at': now - timedelta(days=1)
                    if report.status == LostCatReport.Status.FOUND
                    else None,
                },
            )
            notifications.append(notification)

        # Notification: sighting submitted (owner gets notified)
        for sighting in sightings:
            notification, created = InAppNotification.objects.get_or_create(
                recipient=owner,
                report=sighting.report,
                sighting=sighting,
                event_type=InAppNotification.EventType.SIGHTING_CREATED,
                defaults={
                    'actor': helper,
                    'title': f'New sighting for {sighting.report.cat_name}',
                    'message': (
                        f'{helper.display_name} spotted your cat near '
                        f'{sighting.location_description}.'
                    ),
                    'action_url': f'/reports/{sighting.report.public_id}',
                    'is_read': sighting.verification_status != Sighting.VerificationStatus.PENDING,
                    'read_at': now - timedelta(hours=2)
                    if sighting.verification_status != Sighting.VerificationStatus.PENDING
                    else None,
                },
            )
            notifications.append(notification)

        # Notification: sighting marked useful (helper gets feedback)
        useful_sightings = [
            s for s in sightings
            if s.verification_status == Sighting.VerificationStatus.USEFUL
        ]
        for sighting in useful_sightings:
            notification, created = InAppNotification.objects.get_or_create(
                recipient=helper,
                report=sighting.report,
                sighting=sighting,
                event_type=InAppNotification.EventType.SIGHTING_MARKED_USEFUL,
                defaults={
                    'actor': owner,
                    'title': 'Your sighting was marked useful!',
                    'message': (
                        f'{owner.display_name} confirmed your sighting of '
                        f'{sighting.report.cat_name} was helpful.'
                    ),
                    'action_url': f'/reports/{sighting.report.public_id}',
                    'is_read': False,
                },
            )
            notifications.append(notification)

        # Notification: status changed to FOUND (for owner of Felix)
        felix_report = reports.get('Felix')
        if felix_report and felix_report.status == LostCatReport.Status.FOUND:
            notification, created = InAppNotification.objects.get_or_create(
                recipient=owner,
                report=felix_report,
                event_type=InAppNotification.EventType.REPORT_STATUS_CHANGED,
                defaults={
                    'actor': owner,
                    'title': 'Felix is found! 🎉',
                    'message': 'You marked Felix as found. The report is now resolved.',
                    'action_url': f'/reports/{felix_report.public_id}',
                    'is_read': True,
                    'read_at': now - timedelta(days=1),
                },
            )
            notifications.append(notification)

        return notifications
