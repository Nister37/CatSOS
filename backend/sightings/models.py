from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from reports.models import LostCatReport

from .validators import validate_sighting_photo_upload


class Sighting(models.Model):
    class Confidence(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        USEFUL = 'USEFUL', 'Useful'
        FALSE = 'FALSE', 'False'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    report = models.ForeignKey(
        LostCatReport,
        on_delete=models.CASCADE,
        related_name='sightings',
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='submitted_sightings',
        blank=True,
        null=True,
    )
    seen_at = models.DateTimeField()
    location_description = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField(
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.FloatField(
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    confidence = models.CharField(
        max_length=20,
        choices=Confidence.choices,
        default=Confidence.MEDIUM,
    )
    notes = models.TextField(blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-seen_at', '-created_at')
        indexes = [
            models.Index(fields=('report', '-seen_at')),
            models.Index(fields=('submitted_by', '-created_at')),
            models.Index(fields=('verification_status', '-created_at')),
        ]

    def __str__(self):
        return f'Sighting for {self.report_id} at {self.seen_at:%Y-%m-%d %H:%M}'


def sighting_photo_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return f'sighting-photos/{uuid4().hex}{extension}'


class SightingPhoto(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    sighting = models.ForeignKey(
        Sighting,
        on_delete=models.CASCADE,
        related_name='photos',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='uploaded_sighting_photos',
        blank=True,
        null=True,
    )
    image = models.ImageField(
        upload_to=sighting_photo_upload_to,
        validators=[validate_sighting_photo_upload],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('created_at',)
        indexes = [
            models.Index(fields=('sighting', 'created_at')),
            models.Index(fields=('uploaded_by', '-created_at')),
        ]

    def __str__(self):
        return f'Photo for sighting {self.sighting_id}'

# Create your models here.
