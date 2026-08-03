"""Seed deterministic MOCK market data so the full app demos today.

The NGX licensed-feed decision is still pending (NF-5/6 assessment, 2026-08-03).
Until that lands, this command populates the equity/market layer (F-01/F-02/F-03)
with clearly-labelled, deterministic, synthetic data so every page renders with
realistic content. Nothing here is real market data and nothing here is
investment advice.

Deterministic: the same input always produces the same series (fixed per-symbol
random seed), so re-running is idempotent and reviewable.

Usage:
    python manage.py seed_mock_market_data
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import (
    Region, Currency, Market, Exchange, Issuer, Instrument,
    MarketIndex, PriceHistory, NewsArticle, EarningsCalendar,
)

# One entry per CompanyProfile symbol: (symbol, base_price_naira, vol_factor)
EQUITIES = [
    ('DANGCEM', Decimal('510.00'), Decimal('0.014')),
    ('MTNN', Decimal('228.00'), Decimal('0.012')),
    ('GTCO', Decimal('52.50'), Decimal('0.016')),
    ('ZENITHBANK', Decimal('44.00'), Decimal('0.015')),
    ('UBA', Decimal('31.20'), Decimal('0.018')),
    ('FBNH', Decimal('33.50'), Decimal('0.017')),
    ('NB', Decimal('31.00'), Decimal('0.013')),
    ('NESTLE', Decimal('890.00'), Decimal('0.011')),
    ('AIRTELAFRI', Decimal('2350.00'), Decimal('0.012')),
    ('SEPLAT', Decimal('3100.00'), Decimal('0.016')),
    ('BUACEMENT', Decimal('148.00'), Decimal('0.015')),
    ('ACCESS', Decimal('22.90'), Decimal('0.017')),
]

INDEXES = [
    ('NGXASI', 'NGX All-Share Index', Decimal('106542.31'), Decimal('312.45')),
    ('NGX30', 'NGX 30 Index', Decimal('4108.72'), Decimal('14.20')),
    ('NGXBNK', 'NGX Banking Index', Decimal('962.14'), Decimal('6.85')),
    ('NGXCNSMRG', 'NGX Consumer Goods Index', Decimal('1442.68'), Decimal('-3.12')),
    ('NGXOILGS', 'NGX Oil & Gas Index', Decimal('1188.40'), Decimal('9.94')),
]

NEWS = [
    ('NGX Exchange', 'NGX All-Share Index extends gains as banking stocks rally'),
    ('BusinessDay', 'CBN holds policy rate; analysts eye FX stability in Q3'),
    ('ThisDay', 'DMO announces fresh FGN bond issuance for August reopening'),
    ('Nairametrics', 'Money market funds see inflows as yields stay elevated'),
    ('Punch', 'Pension contributions rise, boosting demand for FGN securities'),
    ('The Guardian', 'NGX lists new corporate bond; market breadth improves'),
]

# Trading-day lookback for OHLCV series
HISTORY_DAYS = 180


class Command(BaseCommand):
    help = "Seed deterministic mock equity/market data (F-01/F-02/F-03 demo layer)."

    @transaction.atomic
    def handle(self, *args, **options):
        today = date.today()

        # --- Base geography (idempotent, matches seed_public_data conventions) ---
        region, _ = Region.objects.get_or_create(iso_code='NGA', defaults={'name': 'Nigeria'})
        currency, _ = Currency.objects.get_or_create(code='NGN', defaults={'name': 'Nigerian Naira', 'symbol': '₦'})
        market, _ = Market.objects.get_or_create(
            name='Equities',
            defaults={'description': 'Nigerian equities (NGX)'},
        )
        exchange, _ = Exchange.objects.get_or_create(
            code='NGX',
            defaults={
                'name': 'Nigerian Exchange Group',
                'market': market,
                'region': region,
                'timezone': 'Africa/Lagos',
            },
        )

        # --- Equity instruments + synthetic OHLCV ---
        equities_created = 0
        history_rows = 0
        for symbol, base_price, vol in EQUITIES:
            issuer, _ = Issuer.objects.get_or_create(
                name=symbol,
                defaults={'region': region, 'industry_sector': 'Equities (mock)'},
            )
            instrument, created = Instrument.objects.update_or_create(
                exchange=exchange,
                symbol=symbol,
                defaults={
                    'name': symbol,
                    'asset_class': 'EQUITY',
                    'issuer': issuer,
                    'base_currency': currency,
                    'last_price': base_price,
                    'is_active': True,
                },
            )
            if created:
                equities_created += 1

            # Deterministic pseudo-random walk per symbol.
            rng = random.Random(f"naija-finance-mock-{symbol}")
            price = float(base_price)
            # Walk backwards from today so the final close equals last_price.
            series = []
            trading_days = 0
            d = today
            while trading_days < HISTORY_DAYS:
                if d.weekday() < 5:
                    series.append((d, price))
                    trading_days += 1
                    price = price * (1 + rng.gauss(0, float(vol)))
                d -= timedelta(days=1)
            series.reverse()

            for day, close in series:
                daily_vol = close * float(vol) * 0.4
                open_p = close * (1 + rng.gauss(0, float(vol) * 0.3))
                high = max(open_p, close) + abs(rng.gauss(0, daily_vol * 0.5))
                low = min(open_p, close) - abs(rng.gauss(0, daily_vol * 0.5))
                volume = int(rng.uniform(200_000, 8_000_000))
                _, hist_created = PriceHistory.objects.update_or_create(
                    instrument=instrument,
                    date=day,
                    defaults={
                        'open_price': Decimal(str(round(open_p, 4))),
                        'high_price': Decimal(str(round(high, 4))),
                        'low_price': Decimal(str(round(low, 4))),
                        'close_price': Decimal(str(round(close, 4))),
                        'volume': volume,
                    },
                )
                if hist_created:
                    history_rows += 1

        # --- Market indexes ---
        indexes_created = 0
        for symbol, name, price, change in INDEXES:
            index, created = MarketIndex.objects.update_or_create(
                symbol=symbol,
                defaults={
                    'exchange': exchange,
                    'name': name,
                    'current_price': price,
                    'point_change': change,
                    'percent_change': (change / price * 100).quantize(Decimal('0.0001')),
                },
            )
            if created:
                indexes_created += 1

        # --- Mock news ---
        news_created = 0
        for source, title in NEWS:
            _, created = NewsArticle.objects.update_or_create(
                source=source,
                title=title,
                defaults={
                    'url': '',
                    'published_at': timezone.make_aware(datetime.combine(today, datetime.min.time())),
                },
            )
            if created:
                news_created += 1

        # --- Mock earnings calendar ---
        earnings_created = 0
        for offset_days, symbol in [(14, 'DANGCEM'), (21, 'MTNN'), (30, 'GTCO'), (45, 'ZENITHBANK')]:
            instrument = Instrument.objects.filter(exchange=exchange, symbol=symbol).first()
            if not instrument:
                continue
            _, created = EarningsCalendar.objects.update_or_create(
                instrument=instrument,
                report_date=timezone.make_aware(datetime.combine(today + timedelta(days=offset_days), datetime.min.time())),
                defaults={},
            )
            if created:
                earnings_created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Mock seed: {equities_created} equities, {history_rows} OHLCV rows, "
            f"{indexes_created} indexes, {news_created} news, {earnings_created} earnings."
        ))
