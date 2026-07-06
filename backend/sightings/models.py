from uuid import uuid4

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from reports.models import LostCatReport


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

# Create your models here.
