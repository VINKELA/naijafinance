"""Enrich staging with more mock data for proper testing (idempotent).

Adds: more news, funds + NAV history, auctions, FX pairs (incl. parallel),
companies, bonds/T-bills, and enriches the demo user (watchlist, portfolio,
alerts). Deterministic; safe to re-run.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from api.models import (
    Region, Currency, Market, Exchange, Issuer, Instrument,
    NewsArticle, Fund, NavSnapshot, AuctionCalendar, FxRate,
    CompanyProfile, Watchlist, Portfolio, PortfolioItem, Alert,
)

User = get_user_model()

MORE_NEWS = [
    ('Nairametrics', 'Inflation eases to 33.4% as food prices moderate in July'),
    ('The Guardian', 'NGX market capitalisation crosses ₦62trn milestone'),
    ('BusinessDay', 'Dangote refinery lifts fuel exports; naira outlook improves'),
    ('Punch', 'Pension funds increase equity exposure as yields compress'),
    ('ThisDay', 'CBN unveils new FX code to boost transparency in interbank market'),
    ('Financial Times', 'Nigeria sovereign bonds rally as investors eye reforms'),
    ('Reuters', 'Nigerian banks post record profits on FX revaluation gains'),
    ('Bloomberg', 'MTN Nigeria to pay interim dividend after strong H1'),
]

MORE_FUNDS = [
    ('Stanbic IBTC Money Market Fund', 'Stanbic IBTC Asset Management', 'MONEY', Decimal('1.2841')),
    ('ARM Aggressive Equity Fund', 'ARM Investment Managers', 'EQUITY', Decimal('7.9320')),
    ('Cordros Money Market Fund', 'Cordros Asset Management', 'MONEY', Decimal('1.1025')),
    ('FBNQuest Fixed Income Fund', 'FBNQuest Asset Management', 'FIXED', Decimal('2.3180')),
    ('United Capital Money Market Fund', 'United Capital Asset Management', 'MONEY', Decimal('1.0876')),
    ('Meristem Income Fund', 'Meristem Asset Management', 'FIXED', Decimal('1.5340')),
    ('Chapel Hill Denali Equity Fund', 'Chapel Hill Denali AM', 'EQUITY', Decimal('4.2100')),
    ('RMB Nigeria Money Market Fund', 'RMB Asset Management', 'MONEY', Decimal('1.0110')),
]

MORE_AUCTIONS = [
    ('FGN FEB-2035', '15-yr new issue', '15Y', Decimal('150'), Decimal('19.10')),
    ('NTB 182-DAY', 'Treasury bill', '182D', Decimal('200'), Decimal('17.55')),
    ('NTB 91-DAY', 'Treasury bill', '91D', Decimal('150'), Decimal('16.10')),
    ('FGN JAN-2029', '7-yr reopening', '7Y', Decimal('180'), Decimal('18.85')),
    ('FGN APR-2049', '25-yr new issue', '25Y', Decimal('100'), Decimal('19.75')),
]

MORE_FX = [
    ('USD/NGN', '1538.50', 'CBN Official'),
    ('USD/NGN-PARALLEL', '1610.00', 'Parallel Market'),
    ('CNY/NGN', '213.40', 'CBN Official'),
    ('JPY/NGN', '10.48', 'CBN Official'),
]

MORE_COMPANIES = [
    ('BUAFOODS', 'BUA Foods', 'Consumer Goods', '28.40', '9.2', '18.10', '3200000000000'),
    ('WAPCO', 'Lafarge Africa', 'Building Materials', '9.75', '7.4', '14.20', '478000000000'),
    ('OANDO', 'Oando PLC', 'Oil & Gas', '6.10', '3.8', '11.90', '885000000000'),
    ('SEPLAT', 'Seplat Energy', 'Oil & Gas', '98.20', '12.6', '240.00', '5800000000000'),
    ('FLOURMILL', 'Flour Mills of Nigeria', 'Consumer Goods', '12.05', '5.1', '22.30', '494000000000'),
    ('UBA', 'United Bank for Africa', 'Banking', '3.40', '2.1', '31.00', '1160000000000'),
]

MORE_BONDS = [
    ('FGN-JAN-2029', '7-yr FGN bond', date(2029, 1, 15), '18.50'),
    ('FGN-FEB-2035', '15-yr FGN bond', date(2035, 2, 15), '19.10'),
    ('NTB-364', '364-day T-bill', date(2025, 8, 14), '17.80'),
]


class Command(BaseCommand):
    help = 'Add more mock/test data to staging (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        region = Region.objects.filter(iso_code='NGA').first()
        ngn = Currency.objects.filter(code='NGN').first()
        ngx = Exchange.objects.filter(code='NGX').first()
        dmo = Exchange.objects.filter(code='DMO').first()

        # News
        added_news = 0
        for src, title in MORE_NEWS:
            if not NewsArticle.objects.filter(title=title).exists():
                NewsArticle.objects.create(source=src, title=title,
                                           published_at=timezone.now() - timedelta(hours=added_news * 5))
                added_news += 1

        # Funds + NAV history
        added_funds = 0
        for name, mgr, cls, base_nav in MORE_FUNDS:
            fund, created = Fund.objects.get_or_create(
                name=name, defaults={'manager': mgr, 'asset_class': cls})
            if created:
                added_funds += 1
            if fund.nav_snapshots.count() < 5:
                for i in range(5):
                    d = date.today() - timedelta(days=i * 2)
                    if not NavSnapshot.objects.filter(fund=fund, date=d).exists():
                        NavSnapshot.objects.create(fund=fund, date=d,
                                                   nav=base_nav + Decimal(i) * Decimal('0.0004'))

        # Auctions (AuctionCalendar uses an Instrument FK)
        added_auctions = 0
        for name, desc, tenor, size, rate in MORE_AUCTIONS:
            d = date.today() + timedelta(days=7 + added_auctions * 7)
            inst = None
            if dmo:
                inst = Instrument.objects.filter(exchange=dmo, symbol=name).first()
                if inst is None:
                    issuer = Issuer.objects.filter(name='Federal Government of Nigeria').first()
                    inst = Instrument.objects.create(
                        exchange=dmo, symbol=name, name=desc, asset_class='BOND',
                        issuer=issuer, base_currency=ngn,
                        maturity_date=d + timedelta(days=365 * 5),
                        coupon_rate=rate, last_price=Decimal('100.00'), is_active=True)
            if inst and not AuctionCalendar.objects.filter(instrument=inst).exists():
                AuctionCalendar.objects.create(
                    instrument=inst, notes=desc, tenor=tenor,
                    offer_size=size, stop_rate=rate, auction_date=d)
                added_auctions += 1

        # FX
        added_fx = 0
        for pair, rate, src in MORE_FX:
            if not FxRate.objects.filter(pair=pair).exists():
                FxRate.objects.create(pair=pair, rate=Decimal(rate),
                                      date=date.today(), source=src)
                added_fx += 1

        # Companies
        added_companies = 0
        for sym, name, sector, eps, pe, bv, mcap in MORE_COMPANIES:
            if not CompanyProfile.objects.filter(symbol=sym).exists():
                CompanyProfile.objects.create(
                    symbol=sym, name=name, sector=sector,
                    eps=Decimal(eps), pe_ratio=Decimal(pe),
                    book_value=Decimal(bv), market_cap=Decimal(mcap),
                    description=f'{name} — public profile (mock data for testing).')
                added_companies += 1

        # Bonds
        added_bonds = 0
        for sym, name, maturity, coupon in MORE_BONDS:
            if dmo and not Instrument.objects.filter(exchange=dmo, symbol=sym).exists():
                issuer = Issuer.objects.filter(name='Federal Government of Nigeria').first()
                Instrument.objects.create(
                    exchange=dmo, symbol=sym, name=name, asset_class='BOND',
                    issuer=issuer, base_currency=ngn, maturity_date=maturity,
                    coupon_rate=Decimal(coupon), last_price=Decimal('100.00'), is_active=True)
                added_bonds += 1

        # Demo user enrichment
        u = User.objects.filter(email='demo@atamatech.com').first()
        enriched = False
        if u:
            wl = u.watchlist_set.first()
            if wl and ngx:
                for inst in Instrument.objects.filter(exchange=ngx, is_active=True):
                    if inst not in wl.instruments.all():
                        wl.instruments.add(inst)
                enriched = True
            pf = u.portfolio_set.first()
            if pf and ngx:
                more_holdings = [('GTCO', 5000, '41.20'), ('ZENITHBANK', 8000, '38.75'), ('NB', 3000, '28.90')]
                for sym, qty, price in more_holdings:
                    inst = Instrument.objects.filter(exchange=ngx, symbol=sym).first()
                    if inst and not PortfolioItem.objects.filter(portfolio=pf, instrument=inst).exists():
                        PortfolioItem.objects.create(portfolio=pf, instrument=inst,
                                                     quantity=Decimal(qty),
                                                     purchase_price=Decimal(price))
                enriched = True
            if u.alerts.count() < 4:
                inst = Instrument.objects.filter(exchange=ngx, symbol='GTCO').first()
                if inst and not Alert.objects.filter(user=u, instrument=inst, alert_type='PRICE').exists():
                    Alert.objects.create(user=u, instrument=inst, alert_type='PRICE',
                                         threshold=Decimal('55'), direction='ABOVE', active=True)
                enriched = True

        self.stdout.write(self.style.SUCCESS(
            f'Enriched: +{added_news} news, +{added_funds} funds, +{added_auctions} auctions, '
            f'+{added_fx} FX, +{added_companies} companies, +{added_bonds} bonds, demo={"yes" if enriched else "already-rich"}'))
