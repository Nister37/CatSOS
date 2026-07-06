import uuid

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    lost_cat_report = apps.get_model('reports', 'LostCatReport')

    for report in lost_cat_report.objects.filter(public_id__isnull=True):
        public_id = uuid.uuid4()
        while lost_cat_report.objects.filter(public_id=public_id).exists():
            public_id = uuid.uuid4()

        report.public_id = public_id
        report.save(update_fields=('public_id',))


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0003_lostcatreport_found_message_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='lostcatreport',
            name='public_id',
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='lostcatreport',
            name='public_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
