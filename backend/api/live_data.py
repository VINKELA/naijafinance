"""
Live data pipelines — zero-licence public sources.
Replaces seed/mock data with actual daily data where legally possible.
"""
import logging
import requests
import xml.etree.ElementTree as ET
from datetime import date, datetime
from decimal import Decimal
from django.utils import timezone
from .models import FxRate

logger = logging.getLogger('live_data')

UA = 'NaijaFinanceHub/1.0 (data aggregation; https://naijafinancehub.com)'

# ── FX RATES: open.er-api.com (free, no key, no rate limit) ───────────────

ER_API_BASE = 'https://open.er-api.com/v6'
TARGET_PAIRS = ['USD', 'GBP', 'EUR', 'CAD', 'CHF', 'CNY', 'JPY', 'INR', 'SAR',
                'GHS', 'KES', 'ZAR', 'XOF']


def fetch_fx_rates() -> dict:
    """Pull latest NGN cross-rates from open.er-api.com free API."""
    created = 0
    try:
        resp = requests.get(f'{ER_API_BASE}/latest/NGN',
                            headers={'User-Agent': UA}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        rate_date = data.get('time_last_update_utc', str(date.today()))[:10]
        rates = data.get('rates', {})

        for pair_code in TARGET_PAIRS:
            rate_val = rates.get(pair_code)
            if rate_val is None:
                continue
            # ER-API gives NGN→USD=0.00067; we want USD/NGN = 1/rate
            pair = f'{pair_code}/NGN'
            display_rate = round(Decimal('1') / Decimal(str(rate_val)), 4)

            _, created_flag = FxRate.objects.update_or_create(
                pair=pair, date=rate_date, source='CBN Official',
                defaults={'rate': display_rate, 'is_active': True},
            )
            if created_flag:
                created += 1

        logger.info('FX rates: fetched %d pairs for %s (%d new)', len(rates), rate_date, created)
    except Exception as e:
        logger.error('FX fetch failed: %s', e)
    return {'pairs_updated': created}


# ── COINGECKO CRYPTO (free tier, 10-30 calls/min) ───────────────────────────

COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
CRYPTO_IDS = ['bitcoin', 'ethereum', 'usdt', 'usd-coin', 'binancecoin', 'solana']


def fetch_crypto_prices() -> dict:
    """Pull NGN-denominated crypto prices from CoinGecko free API."""
    try:
        ids = ','.join(CRYPTO_IDS)
        resp = requests.get(f'{COINGECKO_BASE}/simple/price',
                            params={'ids': ids, 'vs_currencies': 'ngn'},
                            headers={'User-Agent': UA, 'Accept': 'application/json'},
                            timeout=15)
        resp.raise_for_status()
        data = resp.json()
        updated = 0
        for cid in CRYPTO_IDS:
            price = data.get(cid, {}).get('ngn')
            if price is None:
                continue
            pair = f'{cid.upper()}/NGN'
            FxRate.objects.update_or_create(
                pair=pair, date=date.today(), source='CoinGecko',
                defaults={'rate': Decimal(str(round(price, 2))), 'is_active': True},
            )
            updated += 1
        logger.info('Crypto: updated %d pairs', updated)
        return {'crypto_pairs_updated': updated}
    except Exception as e:
        logger.error('Crypto fetch failed: %s', e)
        return {'crypto_pairs_updated': 0}


# ── RSS NEWS AGGREGATOR ─────────────────────────────────────────────────────

RSS_FEEDS = [
    ('Nairametrics', 'https://nairametrics.com/feed/'),
    ('BusinessDay', 'https://businessday.ng/feed/'),
    ('ProShare', 'https://www.proshare.co/feed'),
    ('ThisDay', 'https://www.thisdaylive.com/index.php/feed/'),
    ('Punch Business', 'https://punchng.com/business/feed/'),
]


def fetch_news_rss() -> dict:
    """Aggregate headlines from Nigerian financial RSS feeds into blog posts."""
    from .models import Post  # local import, avoid circular
    created = 0
    for source_name, feed_url in RSS_FEEDS:
        try:
            resp = requests.get(feed_url, headers={'User-Agent': UA}, timeout=20)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            ns = {'content': 'http://purl.org/rss/1.0/modules/content/'}

            for item in root.iter('item'):
                title_el = item.find('title')
                link_el = item.find('link')
                desc_el = item.find('description')
                pub_el = item.find('pubDate')

                title = (title_el.text or '').strip() if title_el is not None else ''
                link = (link_el.text or '').strip() if link_el is not None else ''
                desc = (desc_el.text or '').strip() if desc_el is not None else ''

                if not title or not link:
                    continue

                # Check for duplicate by external link
                if Post.objects.filter(ext_link=link).exists():
                    continue

                Post.objects.create(
                    title=title[:200],
                    body=f'{desc}\n\n<p><a href="{link}" target="_blank" rel="noopener">Read full article →</a></p>',
                    ext_link=link,
                    published_at=timezone.now(),
                    is_rss=True,
                )
                created += 1

        except Exception as e:
            logger.warning('RSS feed %s failed: %s', source_name, e)

    logger.info('RSS news: created %d posts', created)
    return {'news_posts_created': created}


# ── EOD STOCK PRICE CSV UPLOAD ──────────────────────────────────────────────

def process_eod_csv(csv_text: str, exchange_code: str = 'NGX') -> dict:
    """Parse a CSV of end-of-day prices and update the database.
    Expected format: symbol,date,open,high,low,close,volume
    """
    import csv, io
    from .models import Instrument, PriceHistory, Exchange

    try:
        exchange = Exchange.objects.get(code=exchange_code)
    except Exchange.DoesNotExist:
        return {'error': f'Exchange {exchange_code} not found', 'updated': 0}

    reader = csv.DictReader(io.StringIO(csv_text))
    updated = 0
    errors = []

    for row in reader:
        symbol = (row.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        try:
            dt = row.get('date', str(date.today()))
            close_p = Decimal(str(row.get('close', row.get('price', '0'))).replace(',', ''))

            instrument, _ = Instrument.objects.get_or_create(
                exchange=exchange, symbol=symbol,
                defaults={'name': symbol, 'asset_class': 'EQUITY'},
            )

            PriceHistory.objects.update_or_create(
                instrument=instrument, date=dt,
                defaults={
                    'open_price': Decimal(str(row.get('open', close_p)).replace(',', '')),
                    'close_price': close_p,
                    'high_price': Decimal(str(row.get('high', close_p)).replace(',', '')),
                    'low_price': Decimal(str(row.get('low', close_p)).replace(',', '')),
                },
            )
            instrument.last_price = close_p
            instrument.save(update_fields=['last_price', 'updated_at'])
            updated += 1
        except Exception as e:
            errors.append(f'{symbol}: {e}')

    logger.info('EOD CSV: updated %d instruments, %d errors', updated, len(errors))
    return {'updated': updated, 'errors': errors}
