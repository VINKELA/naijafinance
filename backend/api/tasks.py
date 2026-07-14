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
    ScrapeExecution, ScrapeTargetSymbol, 
    Region, Currency, Market, Exchange, Instrument, PriceHistory
)
from .scrapers import CSCSScraper


def exchange_display_name(symbol):
    return f"Nigerian Exchange: {symbol}"


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


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
