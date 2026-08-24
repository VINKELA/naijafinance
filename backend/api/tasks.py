import logging
import os
from datetime import datetime, timedelta
from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# Updated to import the new hierarchical models
from .models import (
    ScrapeExecution, ScrapeTargetSymbol, DataIngestRun,
    Region, Currency, Market, Exchange, Instrument, PriceHistory
)
from .scrapers import CSCSScraper

logger = logging.getLogger(__name__)


def exchange_display_name(symbol):
    return f"Nigerian Exchange: {symbol}"


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# G3 COMPLIANCE (2026-08-03): Login-based CSCS scraping is RETIRED.
# The scraper stays in the tree only so it can be cleanly removed later,
# but it is inert unless CSCS_SCRAPER_ENABLED is explicitly set to true
# (default: off). Do not enable this in production.
CSCS_SCRAPER_RETIRED_MESSAGE = (
    "CSCS login scraping is retired (G3 compliance). "
    "Public free data sources only."
)

GOOGLE_FINANCE_RETIRED_MESSAGE = (
    "Google Finance public-parse is retired (NF-5/6 NO-GO: exchange-licensed data "
    "without an NGX licence; Google ToS anti-scraping clauses). Licensed NGX feeds only."
)


# ==========================================
# S1: scheduled daily SEC NAV ingestion
# ==========================================

# DataIngestRun pks whose failure has already been escalated by email, so a
# scheduler retry of the same failed run cannot spam duplicate ops emails.
_NOTIFIED_INGEST_FAILURES = set()


def _notify_ingest_failure(run):
    """Ops alert email (S5) for a failed scheduled ingestion run.

    The user-scoped Alert model is a threshold-alert for portfolio owners and
    requires an owner FK, so it is not suitable for pipeline failures.
    Instead the failure is (a) persisted on the DataIngestRun row — the
    system of record, visible in Django admin — and (b) escalated once per
    failed run via email to ALERT_OPS_EMAIL (defaults to DEFAULT_FROM_EMAIL).
    Notification errors are logged, never raised.
    """
    logger.error("[%s] ingestion run #%s failed: %s", run.source, run.pk, run.error_message)
    if run.pk in _NOTIFIED_INGEST_FAILURES:
        return
    try:
        from django.conf import settings as dj_settings
        from django.core.mail import send_mail
        send_mail(
            f"[{run.source}] scheduled ingestion failed (run #{run.pk})",
            f"Run #{run.pk} started {run.started_at:%Y-%m-%d %H:%M %Z} FAILED:\n\n"
            f"{run.error_message or 'unknown error'}\n",
            dj_settings.DEFAULT_FROM_EMAIL,
            [dj_settings.ALERT_OPS_EMAIL or dj_settings.DEFAULT_FROM_EMAIL],
            fail_silently=False,
        )
        _NOTIFIED_INGEST_FAILURES.add(run.pk)
    except Exception:
        logger.warning("Could not send ops email for ingest run #%s", run.pk, exc_info=True)


@shared_task
def run_sec_nav_ingest(csv_path=None):
    """Scheduled daily SEC NAV update (S1).

    Runs the ingest_sec_nav management command against SEC_NAV_CSV_PATH,
    records every attempt as a DataIngestRun row, and raises an ops alert
    on failure. With no CSV configured the run is recorded as SKIPPED (not
    an alert-worthy failure) so the beat schedule can be enabled before the
    data-drop automation lands.
    """
    # Overlap guard, mirroring start_daily_cscs_update.
    stale_cutoff = timezone.now() - timedelta(hours=env_int('SEC_NAV_RUN_STALE_HOURS', 2))
    active = (
        DataIngestRun.objects
        .filter(source='SEC_NAV', status='RUNNING')
        .order_by('-started_at')
        .first()
    )
    if active:
        if active.started_at < stale_cutoff:
            active.status = 'FAILED'
            active.error_message = 'Marked stale by the daily SEC NAV scheduler.'
            active.finished_at = timezone.now()
            active.save(update_fields=['status', 'error_message', 'finished_at'])
        else:
            return {"started": False, "reason": "A SEC NAV ingest run is already in progress."}

    path = (csv_path or os.getenv('SEC_NAV_CSV_PATH', '')).strip()
    run = DataIngestRun.objects.create(source='SEC_NAV')
    if not path:
        run.status = 'SKIPPED'
        run.error_message = 'SEC_NAV_CSV_PATH not configured; nothing to ingest.'
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'finished_at'])
        return {"started": False, "status": "SKIPPED", "reason": run.error_message}
    if not os.path.exists(path):
        run.status = 'FAILED'
        run.error_message = f'NAV CSV not found at SEC_NAV_CSV_PATH: {path}'
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'finished_at'])
        _notify_ingest_failure(run)
        return {"started": True, "status": "FAILED", "error": run.error_message}

    try:
        from .management.commands.ingest_sec_nav import import_nav_csv
        result = import_nav_csv(path) or {}
        run.rows_ingested = int(result.get('created', 0))
        run.status = 'SUCCESS'
        return {
            "started": True,
            "status": "SUCCESS",
            "rows_ingested": run.rows_ingested,
            "skipped_rows": int(result.get('skipped', 0)),
        }
    except Exception as exc:
        run.status = 'FAILED'
        run.error_message = str(exc)[:2000]
        _notify_ingest_failure(run)
        return {"started": True, "status": "FAILED", "error": run.error_message}
    finally:
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'rows_ingested', 'error_message', 'finished_at'])


def cscs_scraping_enabled():
    return env_bool('CSCS_SCRAPER_ENABLED', False)


def google_finance_scraping_enabled():
    return env_bool('GOOGLE_FINANCE_SCRAPER_ENABLED', False)


def resolve_cscs_target_url(target_url=None):
    configured_url = (target_url or os.getenv('CSCS_TARGET_URL', '')).strip()
    if configured_url:
        return configured_url

    latest_execution = (
        ScrapeExecution.objects
        .filter(target_url__icontains='cscs.ng')
        .order_by('-created_at')
        .first()
    )
    return latest_execution.target_url if latest_execution else ''


def build_chrome_driver():
    chrome_options = Options()
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--window-size=1440,1200")

    if env_bool('CSCS_HEADLESS', True):
        chrome_options.add_argument("--headless=new")

    chrome_binary_path = os.getenv('CHROME_BINARY_PATH', '').strip()
    if chrome_binary_path:
        chrome_options.binary_location = chrome_binary_path

    chrome_driver_path = os.getenv('CHROMEDRIVER_PATH', '').strip()
    service = Service(chrome_driver_path) if chrome_driver_path else Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)


@shared_task
def start_daily_cscs_update(target_url=None, force=False):
    if not cscs_scraping_enabled():
        return {
            "started": False,
            "reason": CSCS_SCRAPER_RETIRED_MESSAGE,
        }
    resolved_url = resolve_cscs_target_url(target_url)
    if not resolved_url:
        return {
            "started": False,
            "reason": "CSCS_TARGET_URL is not configured and no previous CSCS scrape URL exists.",
        }

    stale_cutoff = timezone.now() - timedelta(hours=env_int('CSCS_ACTIVE_JOB_STALE_HOURS', 20))
    active_execution = (
        ScrapeExecution.objects
        .filter(target_url=resolved_url, status__in=['PENDING', 'RUNNING'])
        .order_by('-created_at')
        .first()
    )
    if active_execution and not force:
        if active_execution.updated_at < stale_cutoff:
            active_execution.status = 'FAILED'
            active_execution.error_message = 'Marked stale by the daily CSCS scheduler.'
            active_execution.save(update_fields=['status', 'error_message', 'updated_at'])
        else:
            return {
                "started": False,
                "reason": "A CSCS update is already pending or running.",
                "job_id": active_execution.id,
                "status": active_execution.status,
            }

    execution = ScrapeExecution.objects.create(target_url=resolved_url)
    run_stateful_scrape.delay(execution.id)
    return {
        "started": True,
        "job_id": execution.id,
        "target_url": resolved_url,
    }

@shared_task
def run_stateful_scrape(execution_id):
    execution = ScrapeExecution.objects.get(id=execution_id)
    if not cscs_scraping_enabled():
        execution.status = 'FAILED'
        execution.error_message = CSCS_SCRAPER_RETIRED_MESSAGE
        execution.save(update_fields=['status', 'error_message', 'updated_at'])
        return {"started": False, "reason": CSCS_SCRAPER_RETIRED_MESSAGE}
    url = execution.target_url or ''
    if 'google.com' in url and '/finance' in url and not google_finance_scraping_enabled():
        execution.status = 'FAILED'
        execution.error_message = GOOGLE_FINANCE_RETIRED_MESSAGE
        execution.save(update_fields=['status', 'error_message', 'updated_at'])
        return {"started": False, "reason": GOOGLE_FINANCE_RETIRED_MESSAGE}
    execution.status = 'RUNNING'
    execution.save()

    driver = None
    try:
        driver = build_chrome_driver()
        
        scraper = CSCSScraper()
        scraper.login_and_navigate(driver, execution.target_url)

        # 1. INITIALIZATION: If this is a fresh execution, populate the targets
        if not execution.symbols.exists():
            all_symbols = scraper.extract_available_symbols(driver)
            
            # Deduplicate using a Set
            unique_symbols = {sym.strip()[:50] for sym in all_symbols if sym.strip()}
            
            # Bulk create the checklist in the database
            target_objects = [
                ScrapeTargetSymbol(execution=execution, symbol=sym) 
                for sym in unique_symbols
            ]
            ScrapeTargetSymbol.objects.bulk_create(target_objects, ignore_conflicts=True)

        # 2. FETCH PENDING: Get everything that hasn't been completed yet
        pending_targets = execution.symbols.filter(status='PENDING').order_by('symbol')

        # --- NEW HIERARCHY SETUP ---
        # Ensure the underlying geography and market structures exist
        region, _ = Region.objects.get_or_create(iso_code='NGA', defaults={'name': 'Nigeria'})
        currency, _ = Currency.objects.get_or_create(code='NGN', defaults={'name': 'Nigerian Naira'})
        market, _ = Market.objects.get_or_create(name='Equities', defaults={'description': 'Stock Market'})
        
        exchange, _ = Exchange.objects.get_or_create(
            code='NGX', 
            defaults={
                'name': 'Nigerian Exchange', 
                'market': market,
                'region': region
            }
        )
        # ---------------------------

        # 3. ATOMIC ITERATION
        for target in pending_targets:
            try:
                # Scrape just this one
                raw_history = scraper.scrape_single_symbol(driver, target.symbol)
                
                if raw_history:
                    # Upgrade: Replace 'Stock' with 'Instrument'
                    instrument, _ = Instrument.objects.get_or_create(
                        exchange=exchange, 
                        symbol=target.symbol, 
                        defaults={
                            'name': exchange_display_name(target.symbol),
                            'asset_class': 'EQUITY',
                            'base_currency': currency
                        }
                    )

                    history_records = []
                    for row in raw_history:
                        try:
                            record_date = datetime.strptime(row['date'], "%d-%b-%Y").date()
                            close_p = Decimal(row['close_price'].replace(',', ''))
                            open_p = Decimal(row['open_price'].replace(',', ''))
                            
                            # Upgrade: Replace 'StockPriceHistory' with 'PriceHistory'
                            history_records.append(PriceHistory(
                                instrument=instrument, 
                                date=record_date, 
                                open_price=open_p, 
                                close_price=close_p
                            ))
                        except Exception:
                            continue # Skip unparseable rows
                    
                    if history_records:
                        PriceHistory.objects.bulk_create(
                            history_records,
                            update_conflicts=True,
                            update_fields=['open_price', 'close_price'],
                            unique_fields=['instrument', 'date'],
                        )
                        latest_record = max(history_records, key=lambda x: x.date)
                        instrument.last_price = latest_record.close_price
                        instrument.save()

                # Mark this specific iteration as safely stored!
                target.status = 'COMPLETED'
                target.save()

            except Exception as iteration_error:
                # If the browser threw "No such window", log it and ABORT the loop
                target.status = 'FAILED'
                target.error_message = str(iteration_error)
                target.save()
                
                print(f"CRITICAL ERROR on {target.symbol}. Terminating loop to allow resume. Error: {str(iteration_error)}")
                execution.status = 'FAILED'
                execution.save()
                return # Exits the task immediately

        # If the loop finishes naturally, everything is done
        execution.status = 'COMPLETED'
        execution.save()

    except Exception as e:
        execution.status = 'FAILED'
        execution.save()
        print(f"Execution failed entirely: {str(e)}")
    
    finally:
        if driver:
            driver.quit()
