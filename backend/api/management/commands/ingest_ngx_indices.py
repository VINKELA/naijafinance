"""Live data pipeline: NGX index levels via the Kobo Terminal (ex-NGX Pulse) API.

Source: ``GET /api/ngxdata/indices`` on koboterminal.com — a Supabase-backed
snapshot of the full NGX index universe (ASI, premium, pension, banking,
sector, bond and commodity benchmarks), refreshed every ~20 minutes during
market hours and 30-min delayed. Requires an API key in ``X-API-Key``.

Upserts ``MarketIndex`` rows: symbol (``ASI`` -> ``NGXASI``), name, level and
daily change. Returns a summary; raises so callers can fail their run logs.

Usage:
    python manage.py ingest_ngx_indices [--file payload.json]
"""
import json
import os
import re
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.management.base import BaseCommand

from api.models import Exchange, Market, MarketIndex, Region

NGX_API_BASE = os.getenv('NGX_PULSE_BASE_URL', 'https://koboterminal.com').rstrip('/')
NGX_INDICES_URL = os.getenv('NGX_PULSE_INDICES_URL', f'{NGX_API_BASE}/api/ngxdata/indices')
HTTP_TIMEOUT = int(os.getenv('NGX_PULSE_TIMEOUT', '30'))


def get_api_key():
    return os.getenv('NGX_PULSE_API_KEY', '').strip()


def fetch_indices(api_key=None, url=NGX_INDICES_URL, timeout=HTTP_TIMEOUT):
    """Download the NGX indices snapshot. Raises on any failure."""
    key = (api_key or get_api_key()).strip()
    if not key:
        raise ValueError('NGX_PULSE_API_KEY is not configured')
    req = urllib.request.Request(
        url,
        headers={
            'X-API-Key': key,
            'Accept': 'application/json',
            'User-Agent': 'naijafinancehub/1.0',
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    return json.loads(raw.decode('utf-8'))


def _symbol_for(code):
    code = re.sub(r'[^A-Za-z0-9]', '', (code or '')).upper()
    if not code:
        return ''
    return code if code.startswith('NGX') else f'NGX{code}'


def _dec(value, places='0.0001'):
    try:
        return Decimal(str(value)).quantize(Decimal(places), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        return None


def import_ngx_indices(payload):
    """Upsert MarketIndex rows from a decoded indices payload.

    Returns a summary dict; raises ValueError when nothing usable is present.
    """
    data = payload.get('data') if isinstance(payload, dict) else payload
    if not isinstance(data, list) or not data:
        raise ValueError('NGX indices payload contained no data')

    region, _ = Region.objects.get_or_create(iso_code='NGA', defaults={'name': 'Nigeria'})
    market, _ = Market.objects.get_or_create(name='Equities', defaults={'description': 'Stock Market'})
    exchange, _ = Exchange.objects.get_or_create(
        code='NGX', defaults={'name': 'Nigerian Exchange', 'market': market, 'region': region},
    )

    created = updated = skipped = 0
    seen = []
    for item in data:
        if not isinstance(item, dict):
            continue
        symbol = _symbol_for(item.get('code') or item.get('slug'))
        level = _dec(item.get('currentPrice'))
        if not symbol or level is None:
            skipped += 1
            continue
        pct = _dec(item.get('changePercentage'))
        # point change is not published directly; derive from % on the level.
        points = None
        if pct is not None:
            points = (level * pct / Decimal('100')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        obj, is_new = MarketIndex.objects.update_or_create(
            symbol=symbol,
            defaults={
                'name': (item.get('name') or symbol).strip()[:100],
                'exchange': exchange,
                'current_price': level,
                'percent_change': pct if pct is not None else Decimal('0'),
                'point_change': points if points is not None else Decimal('0'),
            },
        )
        seen.append(symbol)
        created += int(is_new)
        updated += int(not is_new)

    if not seen:
        raise ValueError('No NGX indices could be mapped from the payload')
    return {'created': created, 'updated': updated, 'skipped': skipped,
            'symbols': sorted(seen), 'count': len(seen)}


def fetch_and_import(api_key=None):
    """Fetch the live indices snapshot and import it. Raises on failure."""
    return import_ngx_indices(fetch_indices(api_key=api_key))


class Command(BaseCommand):
    help = 'Import NGX index levels from the Kobo Terminal (NGX Pulse) API'

    def add_arguments(self, parser):
        parser.add_argument('--file', help='Import from a saved JSON payload instead of the network')

    def handle(self, *args, **options):
        try:
            if options.get('file'):
                with open(options['file'], encoding='utf-8') as fh:
                    payload = json.load(fh)
                result = import_ngx_indices(payload)
            else:
                result = fetch_and_import()
        except Exception as exc:  # noqa: BLE001 - surfaced to the operator
            self.stderr.write(self.style.ERROR(f'NGX index import failed: {exc}'))
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS(
            f"NGX indices imported: {result['created']} new, {result['updated']} updated, "
            f"{result['skipped']} skipped ({result['count']} indices)"
        ))
