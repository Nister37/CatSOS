from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from reports.models import LostCatReport, LostCatReportTimelineEvent
from reports.services import build_report_location_summary


DEMO_PASSWORD = 'CatSOSDemo123!'
DEMO_USER_EMAILS = (
    'owner.demo@catsos.local',
    'helper.demo@catsos.local',
    'admin.demo@catsos.local',
)


@dataclass(frozen=True)
class DemoUserDefinition:
    email: str
    display_name: str
    public_location: str
    public_bio: str
    contribution_points: int
    public_badges: list[str]
    is_staff: bool = False
    is_superuser: bool = False


@dataclass(frozen=True)
class DemoReportDefinition:
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
    notify_email: bool
    status: str
    days_missing: int
    found_message: str = ''


DEMO_USERS = (
    DemoUserDefinition(
        email='owner.demo@catsos.local',
        display_name='Marta Kowalska',
        public_location='Krakow, Poland',
        public_bio='Demo owner coordinating a neighborhood search.',
        contribution_points=45,
        public_badges=['Owner'],
    ),
    DemoUserDefinition(
        email='helper.demo@catsos.local',
        display_name='Jakub Nowak',
        public_location='Krakow, Poland',
        public_bio='Demo volunteer who reports sightings and helps with posters.',
        contribution_points=180,
        public_badges=['Helpful spotter', 'Poster crew'],
    ),
    DemoUserDefinition(
        email='admin.demo@catsos.local',
        display_name='CatSOS Admin',
        public_location='CatSOS moderation',
        public_bio='Demo staff account for reviewing reports and sightings.',
        contribution_points=0,
        public_badges=['Moderator'],
        is_staff=True,
        is_superuser=True,
    ),
)

DEMO_REPORTS = (
    DemoReportDefinition(
        cat_name='Luna',
        age_years=4,
        breed='Domestic shorthair',
        coat_color='Black with a white chest patch',
        eye_color='Green',
        gender=LostCatReport.Gender.FEMALE,
        collar_description='Red reflective collar with a small bell',
        has_microchip=True,
        personality='Shy, food-motivated, usually hides under parked cars.',
        public_summary='Shy black cat with a white chest patch, last seen near Jordan Park.',
        description=(
            'Luna is an indoor cat who slipped out during a delivery. She is likely '
            'hiding close to quiet stairwells, basements, or parked cars.'
        ),
        last_seen_address='Jordan Park demo area, Krakow',
        last_seen_landmark='Jordan Park entrance near the tram stop',
        last_seen_lat=50.0623,
        last_seen_lng=19.9184,
        reward_amount=Decimal('200.00'),
        reward_note='Reward for a confirmed recovery lead.',
        contact_name='Marta Kowalska',
        contact_phone='+48 600 100 200',
        contact_email='owner.demo@catsos.local',
        contact_visibility=LostCatReport.ContactVisibility.APP_ONLY,
        notify_email=True,
        status=LostCatReport.Status.MISSING,
        days_missing=2,
    ),
    DemoReportDefinition(
        cat_name='Pixel',
        age_years=7,
        breed='Maine Coon mix',
        coat_color='Large grey tabby with a fluffy tail',
        eye_color='Amber',
        gender=LostCatReport.Gender.MALE,
        collar_description='Blue collar, tag may have fallen off',
        has_microchip=True,
        personality='Calm and curious, responds to his name and a shaking treat box.',
        public_summary='Large grey tabby, recently seen around the riverside path.',
        description=(
            'Pixel is confident outdoors but avoids loud traffic. He may approach '
            'slowly if someone crouches and speaks softly.'
        ),
        last_seen_address='Vistula river demo area, Krakow',
        last_seen_landmark='Riverside path by the pedestrian bridge',
        last_seen_lat=50.0501,
        last_seen_lng=19.9368,
        reward_amount=None,
        reward_note='',
        contact_name='Marta Kowalska',
        contact_phone='+48 600 100 200',
        contact_email='owner.demo@catsos.local',
        contact_visibility=LostCatReport.ContactVisibility.PUBLIC,
        notify_email=True,
        status=LostCatReport.Status.RECENTLY_SEEN,
        days_missing=5,
    ),
    DemoReportDefinition(
        cat_name='Miso',
        age_years=2,
        breed='European shorthair',
        coat_color='Cream and ginger patches',
        eye_color='Yellow',
        gender=LostCatReport.Gender.UNKNOWN,
        collar_description='No collar',
        has_microchip=False,
        personality='Very timid, does not like being picked up.',
        public_summary='Small cream-and-ginger cat, found safe after a poster scan.',
        description=(
            'Miso was found after a neighbor scanned the QR poster and submitted '
            'a useful sighting through CatSOS.'
        ),
        last_seen_address='Kleparz demo area, Krakow',
        last_seen_landmark='Courtyard behind the local grocery shop',
        last_seen_lat=50.0716,
        last_seen_lng=19.9419,
        reward_amount=Decimal('100.00'),
        reward_note='Thank-you reward already arranged.',
        contact_name='Marta Kowalska',
        contact_phone='+48 600 100 200',
        contact_email='owner.demo@catsos.local',
        contact_visibility=LostCatReport.ContactVisibility.PRIVATE,
        notify_email=False,
        status=LostCatReport.Status.FOUND,
        days_missing=9,
        found_message='Miso is safely home. Thank you to everyone who checked sheds and stairwells.',
    ),
)


class Command(BaseCommand):
    help = 'Seed realistic demo users and lost-cat reports for local demos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=DEMO_PASSWORD,
            help='Password assigned to demo accounts.',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing CatSOS demo users and their reports before seeding.',
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
                self._reset_demo_data()

            users = self._seed_users(password=password)
            reports = self._seed_reports(owner=users['owner.demo@catsos.local'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {len(users)} demo users and {len(reports)} demo reports.'
            )
        )
        self.stdout.write('Demo users: ' + ', '.join(sorted(users)))

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
                'Refusing to create demo accounts with the default password when DEBUG=False.'
            )

    def _reset_demo_data(self):
        User = get_user_model()
        User.objects.filter(email__in=DEMO_USER_EMAILS).delete()

    def _seed_users(self, *, password):
        User = get_user_model()
        users = {}

        for user_definition in DEMO_USERS:
            user, _created = User.objects.get_or_create(email=user_definition.email)
            user.display_name = user_definition.display_name
            user.public_location = user_definition.public_location
            user.public_bio = user_definition.public_bio
            user.contribution_points = user_definition.contribution_points
            user.public_badges = user_definition.public_badges
            user.is_staff = user_definition.is_staff
            user.is_superuser = user_definition.is_superuser
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
                )
            )
            users[user.email] = user

        return users

    def _seed_reports(self, *, owner):
        reports = []
        now = timezone.now()

        for report_definition in DEMO_REPORTS:
            resolved_at = None
            if report_definition.status in {
                LostCatReport.Status.FOUND,
                LostCatReport.Status.CLOSED,
            }:
                resolved_at = now - timedelta(days=1)

            report, _created = LostCatReport.objects.update_or_create(
                owner=owner,
                cat_name=report_definition.cat_name,
                defaults={
                    'age_years': report_definition.age_years,
                    'breed': report_definition.breed,
                    'coat_color': report_definition.coat_color,
                    'eye_color': report_definition.eye_color,
                    'gender': report_definition.gender,
                    'collar_description': report_definition.collar_description,
                    'has_microchip': report_definition.has_microchip,
                    'chip_number': 'DEMO-CHIP-0001'
                    if report_definition.has_microchip
                    else '',
                    'personality': report_definition.personality,
                    'public_summary': report_definition.public_summary,
                    'description': report_definition.description,
                    'disappeared_at': now - timedelta(days=report_definition.days_missing),
                    'last_seen_address': report_definition.last_seen_address,
                    'last_seen_landmark': report_definition.last_seen_landmark,
                    'last_seen_lat': report_definition.last_seen_lat,
                    'last_seen_lng': report_definition.last_seen_lng,
                    'reward_amount': report_definition.reward_amount,
                    'reward_note': report_definition.reward_note,
                    'contact_name': report_definition.contact_name,
                    'contact_phone': report_definition.contact_phone,
                    'contact_email': report_definition.contact_email,
                    'contact_visibility': report_definition.contact_visibility,
                    'notify_push': True,
                    'notify_sms': False,
                    'notify_email': report_definition.notify_email,
                    'status': report_definition.status,
                    'found_message': report_definition.found_message,
                    'resolved_at': resolved_at,
                    'moderation_status': LostCatReport.ModerationStatus.APPROVED,
                    'moderation_notes': '',
                },
            )
            self._ensure_report_created_event(report=report, owner=owner)
            reports.append(report)

        return reports

    def _ensure_report_created_event(self, *, report, owner):
        event, created = LostCatReportTimelineEvent.objects.get_or_create(
            report=report,
            event_type=LostCatReportTimelineEvent.EventType.REPORT_CREATED,
            defaults={
                'actor': owner,
                'location_summary': build_report_location_summary(report),
            },
        )
        if created:
            return

        location_summary = build_report_location_summary(report)
        if event.actor_id != owner.id or event.location_summary != location_summary:
            event.actor = owner
            event.location_summary = location_summary
            event.save(update_fields=('actor', 'location_summary'))
