from uuid import uuid4

from django.conf import settings
from django.db import models


class InAppNotification(models.Model):
    class EventType(models.TextChoices):
        REPORT_CREATED = 'REPORT_CREATED', 'Report created'
        REPORT_STATUS_CHANGED = 'REPORT_STATUS_CHANGED', 'Report status changed'
        SIGHTING_CREATED = 'SIGHTING_CREATED', 'Sighting created'
        SIGHTING_MARKED_USEFUL = 'SIGHTING_MARKED_USEFUL', 'Sighting marked useful'
        SIGHTING_MARKED_FALSE = 'SIGHTING_MARKED_FALSE', 'Sighting marked false'

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='in_app_notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='created_in_app_notifications',
        blank=True,
        null=True,
    )
    report = models.ForeignKey(
        'reports.LostCatReport',
        on_delete=models.CASCADE,
        related_name='in_app_notifications',
        blank=True,
        null=True,
    )
    sighting = models.ForeignKey(
        'sightings.Sighting',
        on_delete=models.CASCADE,
        related_name='in_app_notifications',
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    title = models.CharField(max_length=160)
    message = models.CharField(max_length=300)
    action_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('recipient', '-created_at')),
            models.Index(fields=('recipient', 'is_read', '-created_at')),
            models.Index(fields=('event_type', '-created_at')),
        ]

    def __str__(self):
        return f'{self.event_type} notification'
