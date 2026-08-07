"""
Live data pipeline: CBN FX rates.
Source: https://www.cbn.gov.ng/api/GetAllExchangeRates (public JSON API)
Refresh: daily at 10:00 WAT
"""
import json, time, urllib.request
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import FxRate

CURRENCY_MAP = {
    'US DOLLAR': 'USD/NGN', 'POUNDS STERLING': 'GBP/NGN', 'EURO': 'EUR/NGN',
    'YUAN/RENMINBI': 'CNY/NGN', 'YEN': 'JPY/NGN', 'SWISS FRANC': 'CHF/NGN',
    'CANADIAN DOLLAR': 'CAD/NGN', 'RIYAL': 'SAR/NGN', 'CFA': 'XAF/NGN',
    'SOUTH AFRICAN RAND': 'ZAR/NGN', 'GHANA CEDI': 'GHS/NGN',
    'DANISH KRONA': 'DKK/NGN', 'UAE DIRHAM': 'AED/NGN',
}

class Command(BaseCommand):
    help = 'Ingest latest CBN FX rates from public API'

    def handle(self, **kwargs):
        self.stdout.write('Fetching CBN FX rates...')
        req = urllib.request.Request(
            'https://www.cbn.gov.ng/api/GetAllExchangeRates',
            headers={'User-Agent': 'NaijaFinanceHub/1.0 (+https://naijafinancehub.com)'}
        )
        data = json.loads(urllib.request.urlopen(req, timeout=30).read())

        latest_date = max(row['ratedate'] for row in data)
        parsed_date = date.fromisoformat(latest_date)

        # Build objects without saving (avoid db lock during processing)
        updates = {}
        for row in data:
            if row['ratedate'] != latest_date:
                continue
            pair = CURRENCY_MAP.get(row['currency'].upper())
            if pair:
                updates[pair] = row['centralrate']

        self.stdout.write(f'  Latest date: {latest_date}, {len(updates)} mapped pairs')

        # Retry loop for SQLite lock
        created, updated = 0, 0
        for attempt in range(5):
            try:
                with transaction.atomic():
                    for pair, rate in updates.items():
                        obj, is_new = FxRate.objects.update_or_create(
                            pair=pair, date=parsed_date,
                            defaults={'rate': rate, 'source': 'CBN'}
                        )
                        if is_new: created += 1
                        else: updated += 1
                break
            except Exception as e:
                if attempt < 4 and 'locked' in str(e).lower():
                    time.sleep(1)
                    created = updated = 0
                else:
                    raise

        self.stdout.write(self.style.SUCCESS(
            f'CBN FX: {created} created, {updated} updated ({len(updates)} pairs, {latest_date})'
        ))
