"""Seed a demo user with watchlist, portfolio positions and alerts.

So the F-01/F-08/F-09 tabs (which are JWT user-scoped) show populated data
immediately in the demo, without requiring the viewer to register.

Usage:
    python manage.py seed_demo_user
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Instrument, Fund, Portfolio, PortfolioItem, Watchlist, Alert

User = get_user_model()

DEMO_EMAIL = "demo@naijafinance.com"
DEMO_PASSWORD = "demo1234"

WATCHLIST_SYMBOLS = ["MTNN", "DANGCEM", "GTCO", "ZENITHBANK", "UBA", "SEPLAT"]

PORTFOLIO = [
    # symbol, quantity, purchase price
    ("MTNN", "120", "210.00"),
    ("DANGCEM", "60", "480.50"),
    ("GTCO", "400", "44.20"),
    ("ZENITHBANK", "350", "38.75"),
    ("UBA", "500", "26.40"),
]

ALERTS = [
    # alert_type, symbol-or-fund, threshold, direction
    ("PRICE", "MTNN", "250.00", "ABOVE"),
    ("PRICE", "DANGCEM", "450.00", "BELOW"),
    ("PRICE", "GTCO", "60.00", "ABOVE"),
    ("NAV", "ARM Money Market Fund", "2.0000", "BELOW"),
]


class Command(BaseCommand):
    help = "Seed demo user with watchlist, portfolio and alerts for the demo."

    @transaction.atomic
    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL,
            defaults={"first_name": "Demo", "last_name": "User"},
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        # F-01: default watchlist
        watchlist, _ = Watchlist.objects.get_or_create(user=user, name="My Watchlist")
        added = 0
        for symbol in WATCHLIST_SYMBOLS:
            inst = Instrument.objects.filter(symbol=symbol, is_active=True).first()
            if inst and not watchlist.instruments.filter(id=inst.id).exists():
                watchlist.instruments.add(inst)
                added += 1

        # F-09: portfolio + positions
        portfolio, _ = Portfolio.objects.get_or_create(user=user, name="Growth")
        positions = 0
        for symbol, qty, price in PORTFOLIO:
            inst = Instrument.objects.filter(symbol=symbol, is_active=True).first()
            if not inst:
                continue
            _, pos_created = PortfolioItem.objects.get_or_create(
                portfolio=portfolio,
                instrument=inst,
                defaults={"quantity": Decimal(qty), "purchase_price": Decimal(price)},
            )
            if pos_created:
                positions += 1

        # F-08: alerts
        alerts = 0
        for alert_type, target, threshold, direction in ALERTS:
            if alert_type == "NAV":
                fund = Fund.objects.filter(name=target, is_active=True).first()
                if not fund:
                    continue
                _, a_created = Alert.objects.get_or_create(
                    user=user, alert_type=alert_type, fund=fund,
                    defaults={"threshold": Decimal(threshold), "direction": direction, "active": True},
                )
            else:
                inst = Instrument.objects.filter(symbol=target, is_active=True).first()
                if not inst:
                    continue
                _, a_created = Alert.objects.get_or_create(
                    user=user, alert_type=alert_type, instrument=inst,
                    defaults={"threshold": Decimal(threshold), "direction": direction, "active": True},
                )
            if a_created:
                alerts += 1

        self.stdout.write(self.style.SUCCESS(
            f"Demo user {DEMO_EMAIL} ({'created' if created else 'exists'}): "
            f"{added} watchlist, {positions} positions, {alerts} alerts. "
            f"Password: {DEMO_PASSWORD}"
        ))
