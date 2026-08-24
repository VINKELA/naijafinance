import os
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core import mail
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Region, Currency, Market, Exchange, Issuer, Instrument,
    AuctionCalendar, Fund, NavSnapshot, FxRate, CompanyProfile, Alert,
    ScrapeExecution, PriceHistory, MarketIndex, NewsArticle, EarningsCalendar,
    Portfolio, PortfolioItem, DataIngestRun,
)
from .tasks import (
    start_daily_cscs_update, run_stateful_scrape, run_sec_nav_ingest,
    _notify_ingest_failure, CSCS_SCRAPER_RETIRED_MESSAGE,
)
from .views import build_portfolio_value_series, build_mix_value_series


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

    # Bonds + DMO auction calendar
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

    # Funds + NAVs
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

    # S2: /api/funds/<id>/info — frozen 15-field schema with provenance
    FUND_INFO_15 = [
        'name', 'manager', 'asset_class',
        'registrar_trustee', 'custodian', 'update_cadence', 'inception_date',
        'benchmark', 'fee_breakdown', 'aum', 'minimum_investment',
        'fact_sheet_url', 'sec_registration_status', 'risk_profile', 'currency',
    ]

    def test_f07_fund_info_all_15_fields_present(self):
        resp = self.client.get(f'/api/funds/{self.fund.id}/info/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        for field in self.FUND_INFO_15:
            self.assertIn(field, data)
            self.assertIn('value', data[field])
            self.assertIn('source', data[field])

    def test_f07_fund_info_missing_data_is_null_and_pending(self):
        resp = self.client.get(f'/api/funds/{self.fund.id}/info/')
        data = resp.json()
        for field in ('registrar_trustee', 'custodian', 'inception_date',
                      'aum', 'fact_sheet_url', 'sec_registration_status'):
            self.assertIsNone(data[field]['value'], field)
            self.assertEqual(data[field]['source'], 'pending_data_acquisition', field)

    def test_f07_fund_info_known_values_keep_value_and_source(self):
        resp = self.client.get(f'/api/funds/{self.fund.id}/info/')
        data = resp.json()
        self.assertEqual(data['name']['value'], 'Test Money Market Fund')
        self.assertEqual(data['name']['source'], 'fund_manager_publication')
        self.assertEqual(data['manager']['value'], 'Test Manager')
        self.assertEqual(data['asset_class']['value'], 'MONEY_MARKET')
        # currency is the honest system default for a Nigerian fund universe
        self.assertEqual(data['currency']['value'], 'NGN')
        self.assertEqual(data['currency']['source'], 'system_default')

    def test_f07_fund_info_includes_nav_data(self):
        resp = self.client.get(f'/api/funds/{self.fund.id}/info')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['latest_nav']['nav'], '1.2500')
        self.assertEqual(len(data['nav_history']), 1)

    def test_f07_fund_info_populated_field_attributed_not_pending(self):
        self.fund.inception_date = date(2020, 3, 1)
        self.fund.aum = Decimal('1250000000.00')
        self.fund.save()
        resp = self.client.get(f'/api/funds/{self.fund.id}/info/')
        data = resp.json()
        self.assertEqual(data['inception_date'], {'value': '2020-03-01', 'source': 'manual_admin_entry'})
        self.assertEqual(data['aum'], {'value': '1250000000.00', 'source': 'manual_admin_entry'})

    def test_f07_fund_info_404_unknown_or_inactive(self):
        resp = self.client.get('/api/funds/999999/info/')
        self.assertEqual(resp.status_code, 404)
        inactive = Fund.objects.get(name='Inactive Fund')
        resp = self.client.get(f'/api/funds/{inactive.id}/info/')
        self.assertEqual(resp.status_code, 404)

    # CBN FX rates
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

    # Company profiles
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

    # Alerts (user-scoped CRUD + evaluation)
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
    """Equity demo layer: deterministic mock seed + public market endpoints."""

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


class SecNavIngestTests(TestCase):
    """S1: scheduled daily SEC NAV ingestion — run logging + failure alerting."""

    def setUp(self):
        self.fund = Fund.objects.create(
            name='Stanbic Money Market Fund', asset_class='MONEY_MARKET',
        )

    def _write_csv(self, content):
        fh = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False)
        fh.write(content)
        fh.close()
        self.addCleanup(os.unlink, fh.name)
        return fh.name

    def test_no_csv_configured_logs_skipped_run(self):
        with mock.patch.dict(os.environ, {'SEC_NAV_CSV_PATH': ''}):
            result = run_sec_nav_ingest()
        self.assertEqual(result['status'], 'SKIPPED')
        run = DataIngestRun.objects.get()
        self.assertEqual(run.status, 'SKIPPED')
        self.assertIn('not configured', run.error_message)

    def test_successful_import_logs_run_and_rows(self):
        path = self._write_csv(
            'fund_name,date,nav\n'
            f'{self.fund.name},2026-08-21,125.4100\n'
        )
        result = run_sec_nav_ingest(csv_path=path)
        self.assertEqual(result['status'], 'SUCCESS')
        self.assertEqual(result['rows_ingested'], 1)
        run = DataIngestRun.objects.get()
        self.assertEqual(run.status, 'SUCCESS')
        self.assertEqual(run.rows_ingested, 1)
        self.assertIsNotNone(run.finished_at)
        self.assertTrue(
            NavSnapshot.objects.filter(fund=self.fund, date=date(2026, 8, 21)).exists()
        )

    def test_missing_csv_fails_run_with_error(self):
        result = run_sec_nav_ingest(csv_path='/nonexistent/nav.csv')
        self.assertEqual(result['status'], 'FAILED')
        run = DataIngestRun.objects.get()
        self.assertEqual(run.status, 'FAILED')
        self.assertIn('not found', run.error_message)
        self.assertIsNotNone(run.finished_at)

    def test_malformed_csv_fails_run(self):
        path = self._write_csv(
            'fund_name,date,nav\n'
            f'{self.fund.name},not-a-date,1.00\n'
        )
        result = run_sec_nav_ingest(csv_path=path)
        self.assertEqual(result['status'], 'FAILED')
        run = DataIngestRun.objects.get()
        self.assertEqual(run.status, 'FAILED')

    def test_overlap_guard_skips_when_fresh_run_in_progress(self):
        DataIngestRun.objects.create(source='SEC_NAV', status='RUNNING')
        result = run_sec_nav_ingest(csv_path='/nonexistent/nav.csv')
        self.assertEqual(result['started'], False)
        self.assertIn('already in progress', result['reason'])
        # No new run row created by the guarded invocation
        self.assertEqual(DataIngestRun.objects.count(), 1)

    def test_stale_running_run_is_marked_failed_then_replaced(self):
        stale = DataIngestRun.objects.create(source='SEC_NAV', status='RUNNING')
        DataIngestRun.objects.filter(pk=stale.pk).update(
            started_at=timezone.now() - timedelta(hours=3),
        )
        with mock.patch.dict(os.environ, {'SEC_NAV_CSV_PATH': ''}):
            result = run_sec_nav_ingest()
        stale.refresh_from_db()
        self.assertEqual(stale.status, 'FAILED')
        self.assertIn('stale', stale.error_message.lower())
        self.assertEqual(result['status'], 'SKIPPED')  # replacement run

    def test_beat_schedule_has_daily_ingest_entry(self):
        from django.conf import settings
        entry = settings.CELERY_BEAT_SCHEDULE.get('sec-nav-daily-ingest')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['task'], 'api.tasks.run_sec_nav_ingest')


class S5EmailNotificationTests(TestCase):
    """S5: email notifications — ops alert on failed ingest + user alert trigger."""

    def setUp(self):
        from . import tasks as api_tasks
        # Run pks repeat across test transactions; reset the escalation guard.
        api_tasks._NOTIFIED_INGEST_FAILURES.clear()
        self.fund = Fund.objects.create(
            name='Stanbic Money Market Fund', asset_class='MONEY_MARKET',
        )

    def _write_csv(self, content):
        fh = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False)
        fh.write(content)
        fh.close()
        self.addCleanup(os.unlink, fh.name)
        return fh.name

    # --- ops email on scheduled ingest failure ---

    def test_failed_run_sends_single_ops_email(self):
        from django.conf import settings
        result = run_sec_nav_ingest(csv_path='/nonexistent/nav.csv')
        self.assertEqual(result['status'], 'FAILED')
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual(msg.to, [settings.ALERT_OPS_EMAIL])
        self.assertIn('SEC_NAV', msg.subject)
        self.assertIn('FAILED', msg.body)
        self.assertIn('not found', msg.body)

    def test_failed_run_email_sent_once_per_run(self):
        run = DataIngestRun.objects.create(
            source='SEC_NAV', status='FAILED', error_message='boom',
        )
        _notify_ingest_failure(run)
        _notify_ingest_failure(run)  # duplicate escalation for the same run
        self.assertEqual(len(mail.outbox), 1)

    def test_successful_and_skipped_runs_send_no_email(self):
        path = self._write_csv(
            'fund_name,date,nav\n'
            f'{self.fund.name},2026-08-21,125.4100\n'
        )
        result = run_sec_nav_ingest(csv_path=path)
        self.assertEqual(result['status'], 'SUCCESS')
        with mock.patch.dict(os.environ, {'SEC_NAV_CSV_PATH': ''}):
            skipped = run_sec_nav_ingest()
        self.assertEqual(skipped['status'], 'SKIPPED')
        self.assertEqual(len(mail.outbox), 0)


class PortfolioInceptionSeriesTests(TestCase):
    """S6: per-asset inception dates in portfolio value series."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(email='s6@test.com', password='testpass123')
        self.portfolio = Portfolio.objects.create(user=self.user, name='S6 Portfolio')
        today = timezone.localdate()
        # Old fund: NAV history predating the window start.
        self.old_fund = Fund.objects.create(name='Old Fund')
        NavSnapshot.objects.create(fund=self.old_fund, date=today - timedelta(days=25), nav=Decimal('1.00'))
        NavSnapshot.objects.create(fund=self.old_fund, date=today, nav=Decimal('2.00'))
        # New fund launched mid-window (5 days ago).
        self.new_fund = Fund.objects.create(name='New Fund')
        NavSnapshot.objects.create(fund=self.new_fund, date=today - timedelta(days=5), nav=Decimal('10.00'))
        NavSnapshot.objects.create(fund=self.new_fund, date=today, nav=Decimal('20.00'))
        PortfolioItem.objects.create(portfolio=self.portfolio, fund=self.old_fund, quantity=Decimal('100'), purchase_price=Decimal('1.00'))
        PortfolioItem.objects.create(portfolio=self.portfolio, fund=self.new_fund, quantity=Decimal('1'), purchase_price=Decimal('10.00'))

    def test_each_item_contributes_only_from_own_inception(self):
        points, missing = build_portfolio_value_series(self.portfolio, 30, with_meta=True)
        today = timezone.localdate()
        by_date = {p['date']: p['value'] for p in points}
        # Series starts at the OLD fund's inception, not earlier.
        first_expected = (today - timedelta(days=25)).isoformat()
        self.assertEqual(points[0]['date'], first_expected)
        # At old-fund inception only the old fund counts (no phantom forward-fill
        # of the not-yet-launched new fund across the window).
        self.assertEqual(by_date[first_expected], 100.0)
        # On the new fund's launch day: old (forward-filled within its own data) + new.
        d_new = (today - timedelta(days=5)).isoformat()
        self.assertEqual(by_date[d_new], 110.0)
        # Today: both funds at latest NAVs.
        self.assertEqual(by_date[today.isoformat()], 220.0)
        # Both funds' inceptions were derived from data (no explicit field yet).
        ids = {m['fund_id'] for m in missing}
        self.assertEqual(ids, {self.old_fund.id, self.new_fund.id})

    def test_plain_call_keeps_backwards_compatible_signature(self):
        points = build_portfolio_value_series(self.portfolio, 30)
        self.assertIsInstance(points, list)
        self.assertTrue(all('date' in p and 'value' in p for p in points))

    def test_performance_endpoint_reports_missing_inception(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.get(f'/api/portfolios/{self.portfolio.id}/performance/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn('items_missing_inception', body)
        ids = {m['fund_id'] for m in body['items_missing_inception']}
        self.assertEqual(ids, {self.old_fund.id, self.new_fund.id})
        self.assertEqual(body['period_days'], 90)  # default period untouched


class MixInceptionSeriesTests(TestCase):
    """S6 equivalent gating for standalone Asset Mix series."""

    def test_mix_series_flags_fund_without_inception_field(self):
        fund = Fund.objects.create(name='Mix Fund')
        first_nav_date = timezone.localdate() - timedelta(days=5)
        NavSnapshot.objects.create(fund=fund, date=first_nav_date, nav=Decimal('10.00'))
        snapshot = {"items": [{"symbol": "Mix Fund", "asset_class": "Fund · Money Market", "value": 1000}]}
        points, missing = build_mix_value_series(snapshot, 30, with_meta=True)
        self.assertEqual(missing, [{"fund": "Mix Fund"}])
        # Series starts at the fund's own inception, not the window start.
        self.assertEqual([p['date'] for p in points], [first_nav_date.isoformat()])
        self.assertEqual(points[0]['value'], 1000.0)

    def test_mix_series_plain_call_backwards_compatible(self):
        points = build_mix_value_series({"items": []}, 30)
        self.assertEqual(points, [])
