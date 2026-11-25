"""Retire legacy seeded FX pairs that have no live source.

CEO decision 2026-11-25: the FX module must show only rates backed by the
official CBN feed. Six demo-seeded pairs were left active with August 2026
dates, which is what made the module look stale. They are not published by
CBN's GetAllExchangeRates endpoint, so they can never be refreshed.

Deactivation (not deletion) keeps the historical rows for audit and makes
re-enabling a data source a simple is_active flip later.
"""
from django.db import migrations

LEGACY_PAIRS = [
    'USD/NGN-PARALLEL',
    'CAD/NGN',
    'GHS/NGN',
    'INR/NGN',
    'KES/NGN',
    'XOF/NGN',
]


def retire(apps, schema_editor):
    FxRate = apps.get_model('api', 'FxRate')
    FxRate.objects.filter(pair__in=LEGACY_PAIRS).update(is_active=False)


def restore(apps, schema_editor):
    # Reversible by design; no data is deleted.
    FxRate = apps.get_model('api', 'FxRate')
    FxRate.objects.filter(pair__in=LEGACY_PAIRS).update(is_active=True)


class Migration(migrations.Migration):
    dependencies = [('api', '0012_fund_aum_fund_benchmark_fund_currency_fund_custodian_and_more')]
    operations = [migrations.RunPython(retire, restore)]
