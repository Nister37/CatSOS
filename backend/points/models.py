from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from .rules import (
    BADGE_RULE_CHOICES,
    BADGE_RULES_BY_CODE,
    POINT_RULE_CHOICES,
    POINT_RULES_BY_REASON,
)


class PointTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='point_transactions',
    )
    reason = models.CharField(max_length=40, choices=POINT_RULE_CHOICES)
    points = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    idempotency_key = models.CharField(max_length=160, unique=True)
    description = models.CharField(max_length=200, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('user', '-created_at')),
            models.Index(fields=('reason', '-created_at')),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(points__gte=1),
                name='point_transaction_points_positive',
            ),
        ]

    def clean(self):
        super().clean()
        rule = POINT_RULES_BY_REASON.get(self.reason)
        if rule is None:
            raise ValidationError({'reason': 'Unknown points reason.'})
        if self.points != rule.points:
            raise ValidationError(
                {'points': f'{self.reason} must award exactly {rule.points} points.'}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reason}: {self.points} points for {self.user_id}'


class UserBadge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='earned_badges',
    )
    code = models.CharField(max_length=40, choices=BADGE_RULE_CHOICES)
    label = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict, blank=True)
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('awarded_at',)
        indexes = [
            models.Index(fields=('user', 'awarded_at')),
            models.Index(fields=('code', 'awarded_at')),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=('user', 'code'),
                name='unique_user_badge_code',
            ),
        ]

    def clean(self):
        super().clean()
        if self.code not in BADGE_RULES_BY_CODE:
            raise ValidationError({'code': 'Unknown badge code.'})

    def save(self, *args, **kwargs):
        rule = BADGE_RULES_BY_CODE.get(self.code)
        if rule is not None:
            self.label = rule.label
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.label} for {self.user_id}'
