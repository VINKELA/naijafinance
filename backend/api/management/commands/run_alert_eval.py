"""Evaluate active user threshold alerts (Sprint 1).

Sets the `triggered` flag / `triggered_at` / `last_value` on alerts whose
current data point crosses the threshold. No notification plumbing yet.

Usage:
    python manage.py run_alert_eval
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Alert, NavSnapshot


class Command(BaseCommand):
    help = "Evaluate active threshold alerts against current free data."

    def handle(self, *args, **options):
        now = timezone.now()
        alerts = (
            Alert.objects.filter(active=True)
            .select_related('instrument', 'fund')
        )

        latest_navs = {}
        for fund_id in NavSnapshot.objects.values_list('fund_id', flat=True).distinct():
            latest = NavSnapshot.objects.filter(fund_id=fund_id).order_by('-date').first()
            if latest:
                latest_navs[fund_id] = latest.nav

        evaluated = triggered = 0
        for alert in alerts:
            value = None
            if alert.alert_type == 'PRICE' and alert.instrument:
                value = alert.instrument.last_price
            elif alert.alert_type == 'YIELD' and alert.instrument:
                if alert.instrument.coupon_rate is not None:
                    value = alert.instrument.coupon_rate * 100  # 0.1455 -> 14.55%
            elif alert.alert_type == 'NAV' and alert.fund:
                value = latest_navs.get(alert.fund_id)

            if value is None:
                continue

            crossed = (
                (alert.direction == 'ABOVE' and value >= alert.threshold)
                or (alert.direction == 'BELOW' and value <= alert.threshold)
            )

            was_triggered = alert.triggered
            alert.last_value = value
            alert.last_evaluated_at = now
            alert.triggered = crossed
            if crossed and not was_triggered:
                alert.triggered_at = now
            alert.save(update_fields=[
                'triggered', 'triggered_at', 'last_evaluated_at', 'last_value', 'updated_at',
            ])
            evaluated += 1
            if crossed:
                triggered += 1

        self.stdout.write(self.style.SUCCESS(
            f"Evaluated {evaluated} active alerts; {triggered} triggered."
        ))
