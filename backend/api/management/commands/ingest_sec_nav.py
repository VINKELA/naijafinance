"""
Live data pipeline: SEC Nigeria mutual fund NAVs.
Source: sec.gov.ng (public NAV data, weekly/monthly publication)
Refresh: weekly (Friday EOD) + manual trigger

Note: SEC site uses JavaScript rendering (Alpine.js + HTMX), making automated
scraping unreliable. This command uses a semi-automated CSV import approach
until a reliable API endpoint is identified. Fund NAV data can be manually
downloaded from sec.gov.ng and imported via:
    python manage.py ingest_sec_nav --file /path/to/nav_data.csv

Expected CSV format: fund_name,date,nav
"""
import csv
from datetime import date
from django.core.management.base import BaseCommand
from api.models import Fund, NavSnapshot


def import_nav_csv(filepath, warn=None):
    """Import NAV rows from a CSV file (fund_name,date,nav).

    Shared by the ``ingest_sec_nav`` management command and the scheduled
    ``run_sec_nav_ingest`` task (S1). Returns {'created': int, 'skipped': int};
    raises on malformed input so callers can fail their run logs.
    """
    warn = warn or (lambda msg: None)
    created = 0
    skipped = 0
    with open(filepath, newline='') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = row.get('fund_name', '').strip()
            nav_date = date.fromisoformat(row['date'].strip())
            nav_value = row['nav'].strip()

            fund = Fund.objects.filter(name__iexact=name, is_active=True).first()
            if not fund:
                warn(f'  Fund not found: {name}, skipping')
                skipped += 1
                continue

            _, is_new = NavSnapshot.objects.update_or_create(
                fund=fund, date=nav_date,
                defaults={'nav': nav_value}
            )
            if is_new:
                created += 1
    return {'created': created, 'skipped': skipped}


class Command(BaseCommand):
    help = 'Import SEC mutual fund NAV data from CSV (or attempt live scrape)'

    def add_arguments(self, parser):
        parser.add_argument('--file', help='CSV file path (fund_name,date,nav)')

    def handle(self, **kwargs):
        filepath = kwargs.get('file')
        if not filepath:
            self.stdout.write(self.style.WARNING(
                'No --file provided. SEC site uses JS rendering; automated scrape not yet built.\n'
                'Usage: python manage.py ingest_sec_nav --file nav_data.csv\n'
                'CSV format: fund_name,date,nav'
            ))
            # Show current fund NAVs
            for f in Fund.objects.filter(is_active=True):
                latest = f.nav_snapshots.order_by('-date').first()
                self.stdout.write(f'  {f.name}: latest NAV = {latest.nav if latest else "N/A"} ({latest.date if latest else "no data"})')
            return

        result = import_nav_csv(
            filepath,
            warn=lambda msg: self.stdout.write(self.style.WARNING(msg)),
        )
        self.stdout.write(self.style.SUCCESS(
            f"SEC NAV imported: {result['created']} new snapshots"
        ))
