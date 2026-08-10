from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_mixshare_snapshot_alter_mixshare_portfolio'),
    ]

    operations = [
        migrations.AddField(
            model_name='mixshare',
            name='visibility',
            field=models.CharField(
                choices=[('public', 'Public'), ('private', 'Private')],
                default='public',
                help_text='Public mixes are viewable by anyone (no account); private mixes are owner-only.',
                max_length=10,
            ),
        ),
    ]
