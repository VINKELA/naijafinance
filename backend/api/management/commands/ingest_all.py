"""
Master data pipeline: run all live data ingestion commands.
Designed to be called from cron:
    0 9 * * 1-5 cd /path && docker exec naijafinance-backend-1 python manage.py ingest_all
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Run all live data pipelines'

    def handle(self, **kwargs):
        self.stdout.write('=== Starting live data pipeline ===')
        
        self.stdout.write('\n[1/2] CBN FX rates...')
        try: call_command('ingest_cbn_fx')
        except Exception as e: self.stdout.write(self.style.ERROR(f'CBN FX FAILED: {e}'))

        self.stdout.write('\n[2/2] SEC NAV (CSV-based; use --file for import)...')
        try: call_command('ingest_sec_nav')
        except Exception as e: self.stdout.write(self.style.ERROR(f'SEC NAV: {e}'))

        self.stdout.write(self.style.SUCCESS('\n=== Pipeline complete ==='))
