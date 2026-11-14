from django.db import models


class IntakeReport(models.Model):
    class Urgency(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'

    class Status(models.TextChoices):
        QUEUED = 'QUEUED', 'Queued'
        REVIEWED = 'REVIEWED', 'Reviewed'
        REJECTED = 'REJECTED', 'Rejected'

    cat_name = models.CharField(max_length=120)
    reporter_email = models.EmailField()
    urgency = models.CharField(
        max_length=20,
        choices=Urgency.choices,
        default=Urgency.MEDIUM,
    )
    description = models.TextField()
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"IntakeReport({self.id}, {self.cat_name}, {self.urgency})"
