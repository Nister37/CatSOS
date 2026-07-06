from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .validators import validate_report_photo_upload


class LostCatReport(models.Model):
    class Status(models.TextChoices):
        MISSING = 'MISSING', 'Missing'
        RECENTLY_SEEN = 'RECENTLY_SEEN', 'Recently seen'
        FOUND = 'FOUND', 'Found'
        CLOSED = 'CLOSED', 'Closed'

    class Gender(models.TextChoices):
        UNKNOWN = 'UNKNOWN', 'Unknown'
        FEMALE = 'FEMALE', 'Female'
        MALE = 'MALE', 'Male'

    class ContactVisibility(models.TextChoices):
        APP_ONLY = 'APP_ONLY', 'Logged-in helpers only'
        PUBLIC = 'PUBLIC', 'Public'
        PRIVATE = 'PRIVATE', 'Owner only'

    class ModerationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending review'
        APPROVED = 'APPROVED', 'Approved'
        HIDDEN = 'HIDDEN', 'Hidden'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    public_id = models.UUIDField(default=uuid4, editable=False, unique=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lost_cat_reports',
    )
    cat_name = models.CharField(max_length=100)
    age_years = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        validators=[MaxValueValidator(30)],
    )
    breed = models.CharField(max_length=100, blank=True)
    coat_color = models.CharField(max_length=120)
    eye_color = models.CharField(max_length=80, blank=True)
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.UNKNOWN,
    )
    collar_description = models.CharField(max_length=200, blank=True)
    has_microchip = models.BooleanField(default=False)
    chip_number = models.CharField(max_length=64, blank=True)
    personality = models.TextField(blank=True)
    description = models.TextField()
    disappeared_at = models.DateTimeField(blank=True, null=True)
    last_seen_address = models.CharField(max_length=255)
    last_seen_landmark = models.CharField(max_length=180, blank=True)
    last_seen_lat = models.FloatField(
        blank=True,
        null=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    last_seen_lng = models.FloatField(
        blank=True,
        null=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    reward_amount = models.DecimalField(
        blank=True,
        null=True,
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    reward_note = models.CharField(max_length=200, blank=True)
    contact_name = models.CharField(max_length=150)
    contact_phone = models.CharField(max_length=40)
    contact_email = models.EmailField()
    contact_visibility = models.CharField(
        max_length=20,
        choices=ContactVisibility.choices,
        default=ContactVisibility.APP_ONLY,
    )
    notify_push = models.BooleanField(default=True)
    notify_sms = models.BooleanField(default=True)
    notify_email = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.MISSING,
    )
    found_message = models.TextField(blank=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
    )
    moderation_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [
            models.Index(fields=('owner', '-updated_at')),
            models.Index(fields=('status', '-updated_at')),
            models.Index(fields=('moderation_status', '-updated_at')),
        ]

    def __str__(self):
        return f'{self.cat_name} ({self.status})'

    @property
    def is_active_search(self):
        return self.status in {
            self.Status.MISSING,
            self.Status.RECENTLY_SEEN,
        }


def lost_cat_report_photo_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return f'lost-cat-report-photos/{uuid4().hex}{extension}'


class LostCatReportPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    report = models.ForeignKey(
        LostCatReport,
        on_delete=models.CASCADE,
        related_name='photos',
    )
    image = models.ImageField(
        upload_to=lost_cat_report_photo_upload_to,
        validators=[validate_report_photo_upload],
    )
    is_main = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-is_main', 'created_at')
        indexes = [
            models.Index(fields=('report', 'is_main')),
            models.Index(fields=('report', 'created_at')),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=('report',),
                condition=models.Q(is_main=True),
                name='unique_main_lost_cat_report_photo',
            ),
        ]

    def __str__(self):
        return f'Photo for {self.report_id}'


class LostCatReportTimelineEvent(models.Model):
    class EventType(models.TextChoices):
        REPORT_CREATED = 'REPORT_CREATED', 'Report created'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status changed'
        SIGHTING_CREATED = 'SIGHTING_CREATED', 'Sighting created'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    report = models.ForeignKey(
        LostCatReport,
        on_delete=models.CASCADE,
        related_name='timeline_events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='lost_cat_report_timeline_events',
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    from_status = models.CharField(
        max_length=20,
        choices=LostCatReport.Status.choices,
        blank=True,
    )
    to_status = models.CharField(
        max_length=20,
        choices=LostCatReport.Status.choices,
        blank=True,
    )
    location_summary = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('report', '-created_at')),
            models.Index(fields=('event_type', '-created_at')),
        ]

    def __str__(self):
        return f'{self.event_type} for {self.report_id}'
