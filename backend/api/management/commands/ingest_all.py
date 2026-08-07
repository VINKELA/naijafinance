"""
Master live data pipeline.
Scheduled via cron: 0 9 * * 1-5
"""
from datetime import date, datetime
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

class Command(BaseCommand):
    help = 'Run all live data pipelines with staleness logging'

    def log_stale(self, key, owner, rows, last_date, cadence_hours):
        """Emit DATASET line to stdout + detect staleness."""
        stale = 'no'
        if last_date and cadence_hours:
            try:
                if isinstance(last_date, str):
                    last_date = date.fromisoformat(last_date)
                if isinstance(last_date, date):
                    last_dt = datetime.combine(last_date, datetime.min.time())
                    threshold = timezone.now() - timezone.timedelta(hours=cadence_hours * 2)
                    if last_dt.replace(tzinfo=None) < threshold.replace(tzinfo=None):
                        stale = 'STALE'
                elif isinstance(last_date, datetime):
                    if last_date.replace(tzinfo=None) < (timezone.now() - timezone.timedelta(hours=cadence_hours * 2)).replace(tzinfo=None):
                        stale = 'STALE'
            except (ValueError, TypeError):
                pass

        self.stdout.write(
            f'DATASET {key} owner={owner} rows={rows} last={last_date} stale={stale}'
            + ('\n' + self.style.WARNING(f'  ⚠ {key} is STALE — last update > 2x cadence') if stale == 'STALE' else '')
        )

    def handle(self, **kwargs):
        self.stdout.write(self.style.SUCCESS(f'=== Pipeline start: {timezone.now().isoformat()} ==='))

        # CBN FX
        self.stdout.write('\n[1/3] CBN FX rates...')
        try:
            call_command('ingest_cbn_fx')
            from api.models import FxRate
            latest = FxRate.objects.order_by('-date').first()
            self.log_stale('cbn_fx', 'product', FxRate.objects.count(), latest.date if latest else None, 24)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  CBN FX FAILED: {e}'))

        # DMO auctions
        self.stdout.write('\n[2/3] DMO auctions...')
        try:
            call_command('ingest_dmo_auctions')
            from api.models import AuctionCalendar
            last_auc = AuctionCalendar.objects.order_by('-auction_date').first()
            self.log_stale('dmo_auctions', 'product', AuctionCalendar.objects.count(),
                          last_auc.auction_date if last_auc else None, 24)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  DMO auctions FAILED: {e}'))

        # SEC NAV
        self.stdout.write('\n[3/3] SEC NAV (CSV)...')
        try:
            call_command('ingest_sec_nav')
            from api.models import NavSnapshot
            last_nav = NavSnapshot.objects.order_by('-date').first()
            self.log_stale('sec_nav', 'product', NavSnapshot.objects.count(),
                          last_nav.date if last_nav else None, 168)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  SEC NAV FAILED: {e}'))

        self.stdout.write(self.style.SUCCESS(f'\n=== Pipeline complete: {timezone.now().isoformat()} ==='))
