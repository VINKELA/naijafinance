"""Evaluate active user threshold alerts.

Sets the `triggered` flag / `triggered_at` / `last_value` on alerts whose
current data point crosses the threshold, and emails the owner once on each
not-triggered -> triggered transition (S5).

Usage:
    python manage.py run_alert_eval
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Alert, NavSnapshot

logger = logging.getLogger(__name__)


def _notify_alert_triggered(alert):
    """Email an alert's owner the first time their alert triggers (S5).

    Only called on the not-triggered -> triggered transition, so repeated
    evaluations while the condition stays true do not resend. Users without
    an email address are silently skipped. Mail errors are logged and never
    raised so a mail outage cannot break the evaluation loop.
    """
    recipient = (alert.user.email or '').strip()
    if not recipient:
        return False
    if alert.instrument_id:
        target = alert.instrument.symbol
    elif alert.fund_id:
        target = alert.fund.name
    else:
        target = alert.get_alert_type_display()
    try:
        from django.conf import settings as dj_settings
        from django.core.mail import send_mail

        from api.email_utils import branded_html
        plain = (
            f"Your {alert.get_alert_type_display()} alert on {target} was triggered.\n\n"
            f"Condition: {alert.direction} {alert.threshold}\n"
            f"Current value: {alert.last_value}\n"
            f"Triggered at: {timezone.localtime(alert.triggered_at):%Y-%m-%d %H:%M:%S %Z}\n"
        )
        html_body = (
            f"Your <b>{alert.get_alert_type_display()}</b> alert on <b>{target}</b> was triggered.<br><br>"
            f"<div style=\"background:#f0f7f2;border:1px solid #0D7C3E;border-radius:8px;padding:14px\">"
            f"Condition: {alert.direction} {alert.threshold}<br>"
            f"Current value: {alert.last_value}<br>"
            f"Triggered at: {timezone.localtime(alert.triggered_at):%Y-%m-%d %H:%M:%S %Z}</div>"
        )
        send_mail(
            f"[NaijaFinanceHub] {target} {alert.get_alert_type_display().lower()} alert triggered",
            plain,
            dj_settings.DEFAULT_FROM_EMAIL,
            [recipient],
            html_message=branded_html("Price alert triggered", html_body),
            fail_silently=False,
        )
        return True
    except Exception:
        logger.warning("Could not send trigger email for alert #%s", alert.pk, exc_info=True)
        return False


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

        evaluated = triggered = notified = 0
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
            newly_triggered = crossed and not was_triggered
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
            if newly_triggered and _notify_alert_triggered(alert):
                notified += 1

        self.stdout.write(self.style.SUCCESS(
            f"Evaluated {evaluated} active alerts; {triggered} triggered; "
            f"{notified} notification(s) sent."
        ))
