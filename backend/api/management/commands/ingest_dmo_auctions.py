"""
Live data pipeline: DMO FGN Bond auction results.
Source: https://www.dmo.gov.ng/fgn-bonds (public HTML)
Refresh: daily post-market (~17:00 WAT)

Note: DMO site structure may change. This scraper targets the current layout
and logs parse failures rather than crashing — manual review queue for misses.
"""
import re, urllib.request
from datetime import date, datetime
from django.core.management.base import BaseCommand
from api.models import Instrument, AuctionCalendar

HEADERS = {'User-Agent': 'NaijaFinanceHub/1.0 (+https://naijafinancehub.com)'}

# Known FGN bond symbols to match against
FGN_BOND_PATTERNS = [
    r'FGN[- ]?(?P<rate>\d+\.?\d*)%?\s*(?P<month>JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(?P<year>\d{4})',
    r'(?P<rate>\d+\.?\d*)%?\s*FGN\s*(?P<month>JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(?P<year>\d{4})',
]

MONTH_MAP = {m: i for i, m in enumerate(['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], 1)}

def parse_dmo_page(html: str) -> list[dict]:
    """Extract auction entries from DMO FGN bonds page. Returns list of {symbol, date, tenor, offer, stop_rate}."""
    results = []
    # Try to find table rows with auction data
    # DMO typically has a table with columns: Date, Instrument, Tenor, Amount Offered, Stop Rate
    table_pattern = re.compile(r'<table[^>]*>.*?</table>', re.DOTALL | re.IGNORECASE)
    row_pattern = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL | re.IGNORECASE)
    cell_pattern = re.compile(r'<t[dh][^>]*>(.*?)</t[dh]>', re.DOTALL | re.IGNORECASE)
    date_pattern = re.compile(r'(\d{1,2})[-\s]+(\w+)[-\s]+(\d{4})')
    rate_pattern = re.compile(r'([\d,.]+)\s*%?')

    for table in table_pattern.finditer(html):
        rows = row_pattern.findall(table.group(0))
        for row in rows[1:]:  # skip header
            cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cell_pattern.findall(row)]
            if len(cells) < 3:
                continue
            # Try to find date, instrument, rate info
            cells_text = ' '.join(cells)
            date_match = date_pattern.search(cells_text)
            rate_matches = rate_pattern.findall(cells_text)

            if date_match:
                try:
                    d = int(date_match.group(1))
                    m = date_match.group(2)[:3].upper()
                    y = int(date_match.group(3))
                    if y < 100:
                        y += 2000
                    auction_date = date(y, MONTH_MAP.get(m, 1), d)
                except (ValueError, KeyError):
                    continue

                entry = {'date': auction_date, 'symbol': '', 'tenor': cells[2] if len(cells) > 2 else '',
                         'offer': rate_matches[0] if rate_matches else None,
                         'stop_rate': rate_matches[1] if len(rate_matches) > 1 else None}
                results.append(entry)
    return results


class Command(BaseCommand):
    help = 'Ingest DMO FGN bond auction results'

    def handle(self, **kwargs):
        req = urllib.request.Request('https://www.dmo.gov.ng/fgn-bonds', headers=HEADERS)
        html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='replace')

        entries = parse_dmo_page(html)
        if not entries:
            self.stdout.write(self.style.WARNING('No auction entries parsed from DMO page — may need parser update'))
            # Fallback: log a few known FGN bonds as active
            today = date.today()
            known_bonds = Instrument.objects.filter(
                asset_class='BOND', is_active=True
            ).values_list('symbol', flat=True)
            self.stdout.write(f'  Active FGN bonds in DB: {list(known_bonds)}')
            return

        created = 0
        for entry in entries:
            # Try to match to a known instrument
            inst = Instrument.objects.filter(
                asset_class='BOND', symbol__icontains=str(entry['date'].year)
            ).first()
            if inst and entry.get('date'):
                _, is_new = AuctionCalendar.objects.update_or_create(
                    instrument=inst, auction_date=entry['date'],
                    defaults={
                        'tenor': entry.get('tenor', ''),
                        'offer_size': entry.get('offer'),
                        'stop_rate': entry.get('stop_rate'),
                    }
                )
                if is_new:
                    created += 1

        self.stdout.write(self.style.SUCCESS(
            f'DMO auctions ingested: {created} new entries from {len(entries)} parsed rows'
        ))
