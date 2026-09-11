"""Live data pipeline: CBN official exchange rates.

Source: the CBN's own JSON endpoint used by the rates pages —
``https://www.cbn.gov.ng/api/GetAllExchangeRates``. Each row carries a
currency, a rate date, and buying/central/selling rates. We persist the
*central* rate as ``FxRate.rate`` (same basis as the seeded rows) and map the
CBN currency names onto ISO pair codes (e.g. ``US DOLLAR`` -> ``USD/NGN``).

The feed holds the full history (~60k rows); by default we import only the
newest rate date so the daily job stays light and idempotent.

Usage:
    python manage.py ingest_cbn_rates [--date YYYY-MM-DD] [--file path.json]
"""
import json
import os
import re
import urllib.request
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import FxRate

CBN_RATES_URL = os.getenv('CBN_RATES_URL', 'https://www.cbn.gov.ng/api/GetAllExchangeRates')
HTTP_TIMEOUT = int(os.getenv('CBN_RATES_TIMEOUT', '60'))

# CBN currency label (normalised: upper, single-spaced) -> ISO/NGN pair.
# The feed contains historical spellings and trailing whitespace/tabs, so
# normalise before lookup and accept the known variants.
CURRENCY_TO_PAIR = {
    'US DOLLAR': 'USD/NGN',
    'POUNDS STERLING': 'GBP/NGN',
    'POUND STERLING': 'GBP/NGN',
    'EURO': 'EUR/NGN',
    'YEN': 'JPY/NGN',
    'JAPANESE YEN': 'JPY/NGN',
    'YUAN/RENMINBI': 'CNY/NGN',
    'SWISS FRANC': 'CHF/NGN',
    'SOUTH AFRICAN RAND': 'ZAR/NGN',
    'DANISH KRONA': 'DKK/NGN',
    'DANISH KRONER': 'DKK/NGN',
    'RIYAL': 'SAR/NGN',
    'UAE DIRHAM': 'AED/NGN',
    'CFA': 'XAF/NGN',
    'SDR': 'XDR/NGN',
    'WAUA': 'XUA/NGN',
}


def normalise_currency(name):
    return re.sub(r'\s+', ' ', (name or '').replace('\t', ' ')).strip().upper()


def fetch_payload(url=CBN_RATES_URL, timeout=HTTP_TIMEOUT):
    """Download and decode the CBN rates JSON. Raises on any failure."""
    req = urllib.request.Request(
        url, headers={'User-Agent': 'naijafinancehub/1.0', 'Accept': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    return json.loads(raw.decode('utf-8'))


def _quantise(value):
    return Decimal(str(value)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


def import_cbn_rates(payload, rate_date=None, warn=None):
    """Upsert FxRate rows from a decoded CBN payload.

    Imports only ``rate_date`` (default: the newest date present). Older rows
    for a pair are deactivated so the public endpoint returns the current
    quoted rate. Returns a summary dict; raises ValueError when the payload
    yields no usable rates so callers can fail their run logs.
    """
    warn = warn or (lambda msg: None)
    if not isinstance(payload, list):
        raise ValueError('CBN rates payload was not a JSON list')

    # Normalise to (normalised_currency, ratedate, centralrate)
    rows = []
    for item in payload:
        cur = normalise_currency(item.get('currency'))
        ratedate = (item.get('ratedate') or '').strip()
        central = item.get('centralrate')
        if not cur or not ratedate or central in (None, ''):
            continue
        rows.append((cur, ratedate, central))

    if not rows:
        raise ValueError('CBN rates payload contained no usable rows')

    if rate_date is None:
        rate_date = max(r[1] for r in rows)
    selected = [r for r in rows if r[1] == rate_date]
    if not selected:
        raise ValueError(f'No CBN rows for rate date {rate_date}')

    try:
        parsed_date = date.fromisoformat(rate_date)
    except ValueError as exc:
        raise ValueError(f'Unparseable CBN ratedate {rate_date!r}') from exc

    created = updated = skipped = 0
    imported_pairs = set()
    for cur, _, central in selected:
        pair = CURRENCY_TO_PAIR.get(cur)
        if not pair:
            skipped += 1
            warn(f'  Unmapped CBN currency: {cur!r}, skipping')
            continue
        try:
            value = _quantise(central)
        except (InvalidOperation, ValueError):
            skipped += 1
            warn(f'  Unparseable rate for {cur!r}: {central!r}, skipping')
            continue

        _, is_new = FxRate.objects.update_or_create(
            pair=pair, date=parsed_date, source='CBN',
            defaults={'rate': value, 'is_active': True},
        )
        imported_pairs.add(pair)
        if is_new:
            created += 1
        else:
            updated += 1

    if not imported_pairs:
        raise ValueError(f'No CBN currencies could be mapped for {rate_date}')

    # Retire superseded rows so the public "latest" view stays unambiguous.
    retired = (FxRate.objects
               .filter(pair__in=imported_pairs, date__lt=parsed_date, is_active=True)
               .update(is_active=False))

    return {
        'created': created,
        'updated': updated,
        'skipped': skipped,
        'retired': retired,
        'rate_date': rate_date,
        'pairs': sorted(imported_pairs),
    }


def fetch_and_import(rate_date=None, warn=None):
    """Fetch the live CBN feed and import it. Raises on any failure."""
    return import_cbn_rates(fetch_payload(), rate_date=rate_date, warn=warn)


class Command(BaseCommand):
    help = 'Import CBN official exchange rates from the CBN JSON API'

    def add_arguments(self, parser):
        parser.add_argument('--date', help='Rate date to import (default: newest in feed)')
        parser.add_argument('--file', help='Import from a saved JSON payload instead of the network')

    def handle(self, *args, **options):
        warn = lambda msg: self.stdout.write(self.style.WARNING(msg))  # noqa: E731
        try:
            if options.get('file'):
                with open(options['file'], encoding='utf-8') as fh:
                    payload = json.load(fh)
            else:
                payload = fetch_payload()
            result = import_cbn_rates(payload, rate_date=options.get('date'), warn=warn)
        except Exception as exc:  # noqa: BLE001 - surfaced to the operator
            self.stderr.write(self.style.ERROR(f'CBN FX import failed: {exc}'))
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS(
            f"CBN FX imported for {result['rate_date']}: "
            f"{result['created']} new, {result['updated']} updated, "
            f"{result['retired']} retired, {result['skipped']} skipped "
            f"({len(result['pairs'])} pairs)"
        ))
