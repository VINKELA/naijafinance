"""Seed the Sprint 1 free data layer from public sources.

Sources are public / freely published information only:
  - FGN bonds & NTB auctions: Debt Management Office (DMO) publications
  - Mutual funds & NAVs: fund managers' published NAV releases
  - FX rates: CBN published official window rates
  - Company profiles: issuers' public filings / exchange listings

No login-based scraping is used. Figures are seeded as display examples for
demo purposes. Nothing here is investment advice.

Usage:
    python manage.py seed_public_data
"""
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import models, transaction

from api.models import (
    Region, Currency, Market, Exchange, Issuer, Instrument,
    AuctionCalendar, Fund, NavSnapshot, FxRate, CompanyProfile,
)



def dedupe_reference(model, key_field):
    """Collapse duplicate reference rows: keep the lowest-id row per key,
    reassign dependent FK rows to the keeper, delete the extras.

    Makes re-running seeds against an already-seeded (or previously dirty)
    database safe and heals rows that predate unique constraints.
    Returns the number of duplicate rows removed.
    """
    removed = 0
    keys = model.objects.values_list(key_field, flat=True).distinct()
    for key in keys:
        rows = list(model.objects.filter(**{key_field: key}).order_by('id'))
        if len(rows) < 2:
            continue
        keeper = rows[0]
        for extra in rows[1:]:
            for rel in model._meta.related_objects:
                if isinstance(rel.field, (models.ForeignKey, models.OneToOneField)):
                    rel.related_model.objects.filter(
                        **{rel.field.name: extra}
                    ).update(**{rel.field.name: keeper})
            extra.delete()
            removed += 1
    return removed


def _get_exchange():
    region, _ = Region.objects.get_or_create(iso_code='NGA', defaults={'name': 'Nigeria'})
    currency, _ = Currency.objects.get_or_create(code='NGN', defaults={'name': 'Nigerian Naira', 'symbol': '₦'})
    market, _ = Market.objects.get_or_create(name='Fixed Income', defaults={'description': 'Bonds & T-bills'})
    exchange, _ = Exchange.objects.get_or_create(
        code='DMO',
        defaults={'name': 'Debt Management Office (Nigeria)', 'market': market, 'region': region},
    )
    return currency, exchange


def _get_or_create_bond(exchange, currency, symbol, name, maturity, coupon):
    # Name is the unique key (dedupe_reference keeps one row per name), so a
    # plain name lookup is safe both on clean DBs and on previously-dirty ones.
    issuer = Issuer.objects.filter(name='Federal Government of Nigeria').order_by('id').first()
    if issuer is None:
        issuer = Issuer.objects.create(
            region=Region.objects.get(iso_code='NGA'),
            name='Federal Government of Nigeria',
        )
    instrument, created = Instrument.objects.get_or_create(
        exchange=exchange, symbol=symbol,
        defaults={
            'name': name,
            'asset_class': 'BOND',
            'issuer': issuer,
            'base_currency': currency,
            'maturity_date': maturity,
            'coupon_rate': coupon,
            'last_price': Decimal('0.00'),
            'is_active': True,
        },
    )
    if not created:
        instrument.is_active = True
        instrument.save(update_fields=['is_active'])
    return instrument


FGN_BONDS = [
    # symbol, name, maturity, coupon (decimal)
    ('FGN-14.55-2029', 'FGN 14.55% FEB 2029', date(2029, 2, 13), Decimal('0.1455')),
    ('FGN-13.98-2028', 'FGN 13.98% FEB 2028', date(2028, 2, 23), Decimal('0.1398')),
    ('FGN-16.29-2047', 'FGN 16.2884% JUN 2047', date(2047, 6, 20), Decimal('0.162884')),
    ('FGN-10.00-2032', 'FGN 10.00% JUL 2032', date(2032, 7, 21), Decimal('0.10')),
    ('NTB-91D', 'FGN 91-day Treasury Bill', None, None),
    ('NTB-182D', 'FGN 182-day Treasury Bill', None, None),
    ('NTB-364D', 'FGN 364-day Treasury Bill', None, None),
]

AUCTIONS = [
    # symbol, auction_date, tenor, offer_size_bn, stop_rate_pct
    ('FGN-14.55-2029', '2026-08-17', '10-year', 250, 15.20),
    ('FGN-13.98-2028', '2026-08-17', '7-year', 200, 14.90),
    ('FGN-16.29-2047', '2026-08-17', '30-year', 150, 16.05),
    ('NTB-91D', '2026-08-19', '91-day', 180, 11.35),
    ('NTB-182D', '2026-08-19', '182-day', 120, 12.10),
    ('NTB-364D', '2026-08-19', '364-day', 240, 13.25),
    ('FGN-10.00-2032', '2026-09-14', '10-year', 225, 15.40),
    ('NTB-364D', '2026-09-16', '364-day', 250, 13.10),
]

FUNDS = [
    # name, manager, asset_class, [(date_offset_days, nav)]  (weekly cadence)
    ('Stanbic IBTC Money Market Fund', 'Stanbic IBTC Asset Management', 'MONEY_MARKET', [(0, 1.2841), (7, 1.2838), (14, 1.2834), (30, 1.2809), (60, 1.2782), (90, 1.2755), (180, 1.2689), (365, 1.2544)]),
    ('ARM Money Market Fund', 'ARM Investment Managers', 'MONEY_MARKET', [(0, 2.0310), (7, 2.0291), (14, 2.0272), (30, 2.0215), (60, 2.0144), (90, 2.0073), (180, 1.9904), (365, 1.9611)]),
    ('FBNQuest Money Market Fund', 'FBNQuest Asset Management', 'MONEY_MARKET', [(0, 1.1152), (7, 1.1146), (14, 1.1140), (30, 1.1113), (60, 1.1071), (90, 1.1030), (180, 1.0955), (365, 1.0794)]),
    ('Meristem Money Market Fund', 'Meristem Asset Management', 'MONEY_MARKET', [(0, 1.5129), (7, 1.5118), (14, 1.5107), (30, 1.5071), (60, 1.5025), (90, 1.4978), (180, 1.4894), (365, 1.4709)]),
    ('United Capital Money Market Fund', 'United Capital Asset Management', 'MONEY_MARKET', [(0, 1.4413), (7, 1.4405), (14, 1.4396), (30, 1.4364), (60, 1.4318), (90, 1.4271), (180, 1.4191), (365, 1.4012)]),
    ('Stanbic IBTC Ethical Fund', 'Stanbic IBTC Asset Management', 'ETHICAL', [(0, 1.8964), (7, 1.8890), (14, 1.8816), (30, 1.8521), (60, 1.8292), (90, 1.8082), (180, 1.7501), (365, 1.6424)]),
    ('ARM Ethical Fund', 'ARM Investment Managers', 'ETHICAL', [(0, 1.7122), (7, 1.7045), (14, 1.6968), (30, 1.6689), (60, 1.6461), (90, 1.6254), (180, 1.5710), (365, 1.4728)]),
    # Balanced + fixed income funds (CEO ask: balanced bonds / fixed income coverage)
    ('Stanbic IBTC Balanced Fund', 'Stanbic IBTC Asset Management', 'BALANCED', [(0, 2.8473), (7, 2.8388), (14, 2.8302), (30, 2.8031), (60, 2.7714), (90, 2.7398), (180, 2.6542), (365, 2.5011)]),
    ('ARM Balanced Fund', 'ARM Investment Managers', 'BALANCED', [(0, 3.1054), (7, 3.0948), (14, 3.0843), (30, 3.0510), (60, 3.0095), (90, 2.9680), (180, 2.8581), (365, 2.6412)]),
    ('FBNQuest Fixed Income Fund', 'FBNQuest Asset Management', 'FIXED_INCOME', [(0, 1.9632), (7, 1.9601), (14, 1.9570), (30, 1.9474), (60, 1.9342), (90, 1.9211), (180, 1.8881), (365, 1.8220)]),
    ('United Capital Fixed Income Fund', 'United Capital Asset Management', 'FIXED_INCOME', [(0, 1.5247), (7, 1.5222), (14, 1.5196), (30, 1.5118), (60, 1.5015), (90, 1.4913), (180, 1.4647), (365, 1.4112)]),
]
FX_RATES = [
    # pair, rate, date
    ('USD/NGN', '1496.5300', '2026-07-31'),
    ('GBP/NGN', '1923.1500', '2026-07-31'),
    ('EUR/NGN', '1620.7800', '2026-07-31'),
    ('USD/NGN', '1501.2100', '2026-07-24'),
    ('GBP/NGN', '1938.4200', '2026-07-24'),
    ('EUR/NGN', '1631.9000', '2026-07-24'),
]

COMPANIES = [
    # symbol, name, sector, description, eps, pe, book_value, market_cap
    ('DANGCEM', 'Dangote Cement Plc', 'Basic Materials',
     'Cement manufacturing company with plants across Nigeria and several African countries.', 24.50, 18.2, 41.80, 4500000000000),
    ('MTNN', 'MTN Nigeria Communications Plc', 'Telecommunications',
     'Largest mobile telecommunications operator in Nigeria.', 21.30, 9.4, 34.10, 5200000000000),
    ('GTCO', 'Guaranty Trust Holding Company Plc', 'Banking',
     'Financial services holding company; banking, payments and asset management.', 28.40, 2.1, 41.20, 1800000000000),
    ('ZENITHBANK', 'Zenith Bank Plc', 'Banking',
     'One of Nigeria\u2019s largest banks by tier-1 capital, with pan-African and UK operations.', 32.10, 2.0, 47.60, 1500000000000),
    ('UBA', 'United Bank for Africa Plc', 'Banking',
     'Pan-African banking group operating in over 20 African countries and globally.', 4.80, 1.8, 12.90, 1000000000000),
    ('FBNH', 'FBN Holdings Plc', 'Banking',
     'Financial services holding company whose principal subsidiary is First Bank of Nigeria.', 5.90, 3.1, 21.70, 900000000000),
    ('NB', 'Nigerian Breweries Plc', 'Consumer Goods',
     'Largest brewing company in Nigeria; part of the Heineken group.', 1.20, 22.5, 11.30, 300000000000),
    ('NESTLE', 'Nestl\u00e9 Nigeria Plc', 'Consumer Goods',
     'Food and beverage company producing brands such as Milo, Maggi and Nescaf\u00e9 in Nigeria.', 28.10, 36.0, 21.50, 1300000000000),
    ('AIRTELAFRI', 'Airtel Africa Plc', 'Telecommunications',
     'Mobile network operator and mobile money provider across Africa, dual-listed on NGX and LSE.', 0.05, 42.0, 1.10, 8000000000000),
    ('SEPLAT', 'Seplat Energy Plc', 'Oil & Gas',
     'Independent oil and gas company producing from assets in the Niger Delta.', 1.45, 7.6, 6.80, 1500000000000),
    ('BUACEMENT', 'BUA Cement Plc', 'Basic Materials',
     'Cement manufacturer with plants in Edo and Sokoto states.', 5.30, 25.0, 12.40, 2000000000000),
    ('ACCESS', 'Access Holdings Plc', 'Banking',
     'Banking group present in 20+ countries with a strong African and UK franchise.', 6.70, 1.9, 24.90, 1200000000000),
]

COMMERCIAL_PAPERS = [
    # symbol, name, issuer_name, maturity, coupon (decimal, discount/yield)
    ('GTB-CP-2026-12', 'GTBank Commercial Paper DEC 2026', 'Guaranty Trust Holding Company Plc', date(2026, 12, 15), Decimal('0.1450')),
    ('DANGCEM-CP-2026-11', 'Dangote Cement CP NOV 2026', 'Dangote Cement Plc', date(2026, 11, 20), Decimal('0.1475')),
    ('MTNN-CP-2026-10', 'MTN Nigeria CP OCT 2026', 'MTN Nigeria Communications Plc', date(2026, 10, 16), Decimal('0.1500')),
    ('ZENITH-CP-2027-01', 'Zenith Bank CP JAN 2027', 'Zenith Bank Plc', date(2027, 1, 22), Decimal('0.1425')),
    ('ACCESS-CP-2026-12', 'Access Holdings CP DEC 2026', 'Access Holdings Plc', date(2026, 12, 4), Decimal('0.1460')),
    ('BUACEM-CP-2026-09', 'BUA Cement CP SEP 2026', 'BUA Cement Plc', date(2026, 9, 25), Decimal('0.1490')),
]

# symbol -> [(year, revenue_ngn), ...] display-only demo series for the revenue chart
REVENUE_HISTORY = {
    'DANGCEM': [(2021, 1552400000000), (2022, 1823600000000), (2023, 2114000000000), (2024, 2389000000000), (2025, 2605000000000)],
    'MTNN': [(2021, 1702000000000), (2022, 2025000000000), (2023, 2348000000000), (2024, 2517000000000), (2025, 2681000000000)],
    'GTCO': [(2021, 612400000000), (2022, 712300000000), (2023, 892000000000), (2024, 1103000000000), (2025, 1248000000000)],
    'ZENITHBANK': [(2021, 584200000000), (2022, 675100000000), (2023, 812400000000), (2024, 968200000000), (2025, 1093000000000)],
    'UBA': [(2021, 498800000000), (2022, 590700000000), (2023, 756900000000), (2024, 891400000000), (2025, 1017000000000)],
    'FBNH': [(2021, 401200000000), (2022, 476800000000), (2023, 588300000000), (2024, 712500000000), (2025, 824600000000)],
    'NB': [(2021, 421500000000), (2022, 448200000000), (2023, 470600000000), (2024, 501300000000), (2025, 529800000000)],
    'NESTLE': [(2021, 384700000000), (2022, 422900000000), (2023, 478600000000), (2024, 521400000000), (2025, 562300000000)],
    'AIRTELAFRI': [(2021, 1285000000000), (2022, 1523000000000), (2023, 1784000000000), (2024, 2012000000000), (2025, 2245000000000)],
    'SEPLAT': [(2021, 387200000000), (2022, 512400000000), (2023, 588900000000), (2024, 642300000000), (2025, 701800000000)],
    'BUACEMENT': [(2021, 402800000000), (2022, 468500000000), (2023, 512600000000), (2024, 571900000000), (2025, 624700000000)],
    'ACCESS': [(2021, 824600000000), (2022, 978500000000), (2023, 1241000000000), (2024, 1523000000000), (2025, 1748000000000)],
}


class Command(BaseCommand):
    help = "Seed public free-data-layer rows (DMO, funds/NAV, CBN FX, company profiles)."

    @transaction.atomic
    def handle(self, *args, **options):
        # Heal reference tables first so the get_or_create/update_or_create
        # calls below can never raise MultipleObjectsReturned or hit stale
        # duplicates (e.g. the 13x 'Federal Government of Nigeria' issuers).
        deduped = sum(
            dedupe_reference(model, key)
            for model, key in (
                (Region, 'iso_code'),
                (Currency, 'code'),
                (Market, 'name'),
                (Exchange, 'code'),
                (Issuer, 'name'),
            )
        )
        currency, exchange = _get_exchange()

        # F-04: Bonds + auction calendar
        bond_map = {}
        for symbol, name, maturity, coupon in FGN_BONDS:
            bond_map[symbol] = _get_or_create_bond(exchange, currency, symbol, name, maturity, coupon)
        auctions = 0
        for symbol, auction_date, tenor, offer, stop_rate in AUCTIONS:
            _, created = AuctionCalendar.objects.update_or_create(
                instrument=bond_map[symbol],
                auction_date=auction_date,
                defaults={
                    'tenor': tenor,
                    'offer_size': Decimal(str(offer)),
                    'stop_rate': Decimal(str(stop_rate)),
                    'is_active': True,
                    'notes': 'Public DMO publication data (seeded example).',
                },
            )
            auctions += 1 if created else 0

        # F-05: Funds + NAV snapshots
        funds = 0
        navs = 0
        for name, manager, asset_class, snapshots in FUNDS:
            fund, created = Fund.objects.update_or_create(
                name=name,
                defaults={'manager': manager, 'asset_class': asset_class, 'is_active': True},
            )
            funds += 1 if created else 0
            today = date.today()
            for offset_days, nav in snapshots:
                _, nav_created = NavSnapshot.objects.update_or_create(
                    fund=fund, date=today - timedelta(days=offset_days),
                    defaults={'nav': Decimal(str(nav))},
                )
                navs += 1 if nav_created else 0

        # F-06: CBN FX rates
        fx = 0
        for pair, rate, fx_date in FX_RATES:
            _, created = FxRate.objects.update_or_create(
                pair=pair, date=fx_date, source='CBN',
                defaults={'rate': Decimal(str(rate)), 'is_active': True},
            )
            fx += 1 if created else 0

        # F-07: Company profiles
        companies = 0
        for symbol, name, sector, description, eps, pe, book_value, market_cap in COMPANIES:
            _, created = CompanyProfile.objects.update_or_create(
                symbol=symbol,
                defaults={
                    'name': name,
                    'sector': sector,
                    'description': description,
                    'eps': Decimal(str(eps)),
                    'pe_ratio': Decimal(str(pe)),
                    'book_value': Decimal(str(book_value)),
                    'market_cap': Decimal(str(market_cap)),
                    'revenue_history': [
                        {'year': y, 'revenue_ngn': str(r)}
                        for y, r in REVENUE_HISTORY.get(symbol, [])
                    ],
                    'is_active': True,
                },
            )
            companies += 1 if created else 0

        # REQ-7: Commercial papers (short-term corporate discount notes)
        cps = 0
        for symbol, name, issuer_name, maturity, coupon in COMMERCIAL_PAPERS:
            issuer, _ = Issuer.objects.get_or_create(
                name=issuer_name,
                defaults={'region': Region.objects.filter(iso_code='NGA').first(), 'industry_sector': 'Financial / Corporate'},
            )
            inst, created = Instrument.objects.get_or_create(
                exchange=exchange, symbol=symbol,
                defaults={
                    'name': name,
                    'asset_class': 'COMMERCIAL_PAPER',
                    'issuer': issuer,
                    'base_currency': currency,
                    'maturity_date': maturity,
                    'coupon_rate': coupon,
                    'last_price': Decimal('0.00'),
                    'is_active': True,
                },
            )
            if not created:
                inst.asset_class = 'COMMERCIAL_PAPER'
                inst.is_active = True
                inst.save(update_fields=['asset_class', 'is_active'])
            cps += 1 if created else 0

        self.stdout.write(self.style.SUCCESS(
            f"Seeded: {auctions} auctions, {funds} funds, {navs} NAV snapshots, {cps} commercial papers, "
            f"{fx} FX rates, {companies} company profiles "
            f"(reference dedupe removed {deduped} stale duplicate rows)."
        ))
