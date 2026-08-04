from datetime import date
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Region, Currency, Market, Exchange, Issuer, Instrument,
    AuctionCalendar, Fund, NavSnapshot, FxRate, CompanyProfile, Alert,
    ScrapeExecution, PriceHistory, MarketIndex, NewsArticle, EarningsCalendar,
)
from .tasks import start_daily_cscs_update, run_stateful_scrape, CSCS_SCRAPER_RETIRED_MESSAGE


def make_fixture():
    region, _ = Region.objects.get_or_create(iso_code='NGA', defaults={'name': 'Nigeria'})
    currency, _ = Currency.objects.get_or_create(code='NGN', defaults={'name': 'Nigerian Naira'})
    market, _ = Market.objects.get_or_create(name='Fixed Income')
    exchange, _ = Exchange.objects.get_or_create(
        code='DMO', defaults={'name': 'DMO', 'market': market, 'region': region},
    )
    issuer, _ = Issuer.objects.get_or_create(
        region=region, name='Federal Government of Nigeria',
        defaults={'industry_sector': 'Government'},
    )
    return currency, exchange, issuer


def make_bond(exchange, currency, issuer, symbol='FGN-10.00-2032', coupon=Decimal('0.10')):
    return Instrument.objects.create(
        asset_class='BOND', symbol=symbol, name=f'FGN 10.00% {symbol}',
        issuer=issuer, exchange=exchange, base_currency=currency,
        maturity_date=date(2032, 7, 21), coupon_rate=coupon,
        last_price=Decimal('100.00'),
    )


class FreeDataLayerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        currency, exchange, issuer = make_fixture()
        self.bond = make_bond(exchange, currency, issuer)
        self.auction = AuctionCalendar.objects.create(
            instrument=self.bond, auction_date=date(2026, 8, 17),
            tenor='10-year', offer_size=Decimal('250.00'),
            stop_rate=Decimal('15.20'), is_active=True,
        )
        AuctionCalendar.objects.create(
            instrument=self.bond, auction_date=date(2025, 1, 1),
            tenor='10-year', offer_size=Decimal('100.00'),
            stop_rate=Decimal('14.00'), is_active=False,
        )
        self.fund = Fund.objects.create(
            name='Test Money Market Fund', manager='Test Manager',
            asset_class='MONEY_MARKET', is_active=True,
        )
        self.nav = NavSnapshot.objects.create(fund=self.fund, date=date.today(), nav=Decimal('1.2500'))
        Fund.objects.create(name='Inactive Fund', manager='X', asset_class='OTHER', is_active=False)
        self.fx = FxRate.objects.create(pair='USD/NGN', rate=Decimal('1496.5300'), date=date.today(), source='CBN')
        FxRate.objects.create(pair='USD/NGN', rate=Decimal('1490.0000'), date=date(2026, 6, 1), source='CBN', is_active=False)
        self.company = CompanyProfile.objects.create(
            symbol='TESTCO', name='Test Company Plc', sector='Banking',
            description='A test company.', eps=Decimal('5.00'),
            pe_ratio=Decimal('10.00'), book_value=Decimal('20.00'),
            market_cap=Decimal('500000000000'), is_active=True,
        )
        CompanyProfile.objects.create(symbol='HIDDEN', name='Hidden Plc', is_active=False)

    # --- F-04: Bonds + DMO auction calendar ---
    def test_f04_bond_instruments_public(self):
        resp = self.client.get('/api/bonds/')
        self.assertEqual(resp.status_code, 200)
        symbols = [row['symbol'] for row in resp.json()]
        self.assertIn(self.bond.symbol, symbols)

    def test_f04_auction_calendar_public_active_only(self):
        resp = self.client.get('/api/auctions/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['instrument_symbol'], self.bond.symbol)
        self.assertEqual(rows[0]['tenor'], '10-year')

    def test_f04_auction_detail_public(self):
        resp = self.client.get(f'/api/auctions/{self.auction.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['stop_rate'], '15.2000')

    # --- F-05: Funds + NAVs ---
    def test_f05_fund_list_public(self):
        resp = self.client.get('/api/funds/')
        self.assertEqual(resp.status_code, 200)
        names = [row['name'] for row in resp.json()]
        self.assertIn('Test Money Market Fund', names)
        self.assertNotIn('Inactive Fund', names)

    def test_f05_fund_detail_has_latest_nav(self):
        resp = self.client.get(f'/api/funds/{self.fund.id}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['latest_nav']['nav'], '1.2500')
        self.assertEqual(len(data['nav_history']), 1)

    # --- F-06: CBN FX rates ---
    def test_f06_fx_rates_public_active_only(self):
        resp = self.client.get('/api/fx-rates/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['pair'], 'USD/NGN')
        self.assertEqual(rows[0]['source'], 'CBN')

    def test_f06_fx_rates_latest_filter(self):
        FxRate.objects.create(pair='USD/NGN', rate=Decimal('1500.0000'), date=date(2025, 1, 1), source='CBN')
        resp = self.client.get('/api/fx-rates/?latest=1')
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['rate'], '1496.5300')

    # --- F-07: Company profiles ---
    def test_f07_company_profiles_public_active_only(self):
        resp = self.client.get('/api/companies/')
        self.assertEqual(resp.status_code, 200)
        symbols = [row['symbol'] for row in resp.json()]
        self.assertIn('TESTCO', symbols)
        self.assertNotIn('HIDDEN', symbols)

    def test_f07_company_detail(self):
        resp = self.client.get(f'/api/companies/{self.company.id}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['sector'], 'Banking')
        self.assertEqual(data['pe_ratio'], '10.0000')

    # --- F-08: Alerts (user-scoped CRUD + evaluation) ---
    def _auth_client(self, email):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(email=email, password='testpass123')
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    def test_f08_alert_create_and_list_user_scoped(self):
        client, _ = self._auth_client('a@test.com')
        resp = client.post('/api/alerts/', {
            'instrument': self.bond.id, 'alert_type': 'PRICE',
            'threshold': '105.00', 'direction': 'ABOVE',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        alert_id = resp.json()['id']

        resp = client.get('/api/alerts/')
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['instrument_symbol'], self.bond.symbol)
        self.assertEqual(rows[0]['triggered'], False)

        # Second user sees nothing
        other_client, _ = self._auth_client('b@test.com')
        resp = other_client.get('/api/alerts/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 0)

        # Second user cannot fetch the first user's alert
        resp = other_client.get(f'/api/alerts/{alert_id}/')
        self.assertEqual(resp.status_code, 404)

    def test_f08_alert_update_delete_scoped(self):
        client, _ = self._auth_client('a@test.com')
        created = client.post('/api/alerts/', {
            'fund': self.fund.id, 'alert_type': 'NAV',
            'threshold': '1.1000', 'direction': 'BELOW',
        }, format='json').json()
        alert_id = created['id']

        resp = client.patch(f'/api/alerts/{alert_id}/', {'threshold': '1.0500'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['threshold'], '1.050000')

        resp = client.delete(f'/api/alerts/{alert_id}/')
        self.assertEqual(resp.status_code, 204)

    def test_f08_alert_validation(self):
        client, _ = self._auth_client('a@test.com')
        # NAV alert without fund
        resp = client.post('/api/alerts/', {
            'alert_type': 'NAV', 'threshold': '1.00', 'direction': 'ABOVE',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        # PRICE alert without instrument
        resp = client.post('/api/alerts/', {
            'alert_type': 'PRICE', 'threshold': '1.00', 'direction': 'ABOVE',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_f08_alert_eval_command(self):
        client, user = self._auth_client('a@test.com')
        price_alert = Alert.objects.create(
            user=user, instrument=self.bond, alert_type='PRICE',
            threshold=Decimal('95.00'), direction='ABOVE', active=True,
        )
        nav_alert = Alert.objects.create(
            user=user, fund=self.fund, alert_type='NAV',
            threshold=Decimal('1.3000'), direction='ABOVE', active=True,
        )
        inactive_alert = Alert.objects.create(
            user=user, instrument=self.bond, alert_type='PRICE',
            threshold=Decimal('1.00'), direction='ABOVE', active=False,
        )

        call_command('run_alert_eval')

        price_alert.refresh_from_db()
        nav_alert.refresh_from_db()
        inactive_alert.refresh_from_db()

        # bond last_price=100 >= 95 -> triggered
        self.assertTrue(price_alert.triggered)
        self.assertIsNotNone(price_alert.triggered_at)
        self.assertEqual(price_alert.last_value, Decimal('100.000000'))
        # latest NAV 1.25 < 1.30 -> not triggered
        self.assertFalse(nav_alert.triggered)
        # inactive alerts are skipped
        self.assertFalse(inactive_alert.triggered)

    def test_f08_alert_eval_resets_trigger(self):
        client, user = self._auth_client('a@test.com')
        alert = Alert.objects.create(
            user=user, instrument=self.bond, alert_type='PRICE',
            threshold=Decimal('95.00'), direction='ABOVE', active=True,
        )
        call_command('run_alert_eval')
        alert.refresh_from_db()
        self.assertTrue(alert.triggered)

        # Raise the threshold above the price so the condition clears.
        alert.threshold = Decimal('500.00')
        alert.save()
        call_command('run_alert_eval')
        alert.refresh_from_db()
        self.assertFalse(alert.triggered)


class G3ComplianceTests(TestCase):
    """Login-based CSCS scraping is retired and inert."""

    def test_g3_start_daily_cscs_update_inert(self):
        result = start_daily_cscs_update()
        self.assertEqual(result['started'], False)
        self.assertIn('retired', result['reason'].lower())

    def test_g3_run_stateful_scrape_marks_failed_retired(self):
        execution = ScrapeExecution.objects.create(target_url='https://cscs.ng/example')
        result = run_stateful_scrape(execution.id)
        execution.refresh_from_db()
        self.assertEqual(execution.status, 'FAILED')
        self.assertEqual(execution.error_message, CSCS_SCRAPER_RETIRED_MESSAGE)
        self.assertEqual(result['started'], False)

    def test_g3_trigger_scrape_rejects_cscs_url(self):
        resp = APIClient().post('/api/scrape/trigger/', {
            'target_url': 'https://cscs.ng/pricelisthistory',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('retired', resp.json()['detail'].lower())

    def test_g3_run_stateful_scrape_rejects_google_finance(self):
        execution = ScrapeExecution.objects.create(target_url='https://www.google.com/finance/quote/AFRIPRUD:NGX')
        result = run_stateful_scrape(execution.id)
        execution.refresh_from_db()
        self.assertEqual(execution.status, 'FAILED')
        self.assertIn('retired', execution.error_message.lower())
        self.assertEqual(result['started'], False)

    def test_g3_beat_schedule_has_no_cscs_entry(self):
        from django.conf import settings
        self.assertNotIn('cscs-daily-data-update', settings.CELERY_BEAT_SCHEDULE)


class SeedCommandTests(TestCase):
    def test_seed_public_data_runs(self):
        call_command('seed_public_data')
        self.assertGreater(AuctionCalendar.objects.count(), 0)
        self.assertGreater(Fund.objects.count(), 0)
        self.assertGreater(NavSnapshot.objects.count(), 0)
        self.assertGreater(FxRate.objects.count(), 0)
        self.assertGreater(CompanyProfile.objects.count(), 0)
        # Idempotent on second run
        count_before = CompanyProfile.objects.count()
        call_command('seed_public_data')
        self.assertEqual(CompanyProfile.objects.count(), count_before)


class MockMarketDataTests(TestCase):
    """F-01/F-02/F-03 demo layer: deterministic mock seed + public market endpoints."""

    def setUp(self):
        self.client = APIClient()
        call_command('seed_mock_market_data')

    def test_mock_seed_creates_equities_history_indexes_news(self):
        self.assertGreater(Instrument.objects.filter(asset_class='EQUITY').count(), 0)
        self.assertGreater(PriceHistory.objects.count(), 0)
        self.assertGreater(MarketIndex.objects.count(), 0)
        self.assertGreater(NewsArticle.objects.count(), 0)
        self.assertGreater(EarningsCalendar.objects.count(), 0)

    def test_mock_seed_is_idempotent(self):
        before = PriceHistory.objects.count()
        call_command('seed_mock_market_data')
        self.assertEqual(PriceHistory.objects.count(), before)

    def test_mock_seed_deterministic_last_price(self):
        inst = Instrument.objects.get(symbol='MTNN', asset_class='EQUITY')
        self.assertGreater(inst.last_price, 0)

    def test_movers_returns_rows(self):
        resp = self.client.get('/api/stocks/movers/?limit=5')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 1)
        row = resp.json()[0]
        for key in ('symbol', 'price', 'changePct', 'isUp'):
            self.assertIn(key, row)

    def test_market_overview_returns_counts(self):
        resp = self.client.get('/api/overview/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertGreater(body['instrumentCount'], 0)
        self.assertIn('topGainers', body)

    def test_indexes_public(self):
        resp = self.client.get('/api/indexes/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.json()), 0)

    def test_stock_detail_has_chart_data(self):
        resp = self.client.get('/api/stock/MTNN/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.json()['chart_data']), 1)

    def test_news_public(self):
        resp = self.client.get('/api/news/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.json()), 0)

    def test_earnings_public(self):
        resp = self.client.get('/api/earnings/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 1)


class ComparePeriodAliasTests(TestCase):
    """REQ-13: compare endpoint must accept spec'd period pills (1w/1m/3m/6m/1y)."""

    def setUp(self):
        self.client = APIClient()
        call_command('seed_mock_market_data')

    def test_string_period_pills_accepted(self):
        for pill, expected in (('1w', 7), ('1m', 30), ('3m', 90), ('6m', 180), ('1y', 365)):
            resp = self.client.get(f'/api/compare/?symbols=MTNN&period={pill}')
            self.assertEqual(resp.status_code, 200, f'period={pill} failed')
            self.assertEqual(resp.json()['period_days'], expected, f'period={pill}')

    def test_uppercase_pills_and_int_still_work(self):
        self.assertEqual(self.client.get('/api/compare/?symbols=MTNN&period=3M').json()['period_days'], 90)
        self.assertEqual(self.client.get('/api/compare/?symbols=MTNN&period=90').json()['period_days'], 90)
        self.assertEqual(self.client.get('/api/compare/?symbols=MTNN').json()['period_days'], 90)

    def test_invalid_period_falls_back_to_default(self):
        resp = self.client.get('/api/compare/?symbols=MTNN&period=bogus')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['period_days'], 90)
