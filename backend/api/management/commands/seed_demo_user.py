"""Seed a demo user with sample watchlist, portfolio and alerts for testing."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from decimal import Decimal

from api.models import Watchlist, Portfolio, PortfolioItem, Alert, Instrument

User = get_user_model()
EMAIL = 'demo@atamatech.com'
PASSWORD = 'DemoPass123!'


class Command(BaseCommand):
    help = 'Create demo user with sample watchlist/portfolio/alerts (testing only).'

    @transaction.atomic
    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(email=EMAIL)
        if created:
            user.set_password(PASSWORD)
            user.is_active = True
            user.save()
            self.stdout.write(f'Created demo user {EMAIL}')
        else:
            self.stdout.write(f'Demo user exists: {EMAIL}')

        wl, _ = Watchlist.objects.get_or_create(user=user, name='Default')
        symbols = ['DANGCEM', 'MTNN', 'GTCO', 'ZENITHBANK']
        for sym in symbols:
            inst = Instrument.objects.filter(symbol=sym).first()
            if inst and inst not in wl.instruments.all():
                wl.instruments.add(inst)

        pf, _ = Portfolio.objects.get_or_create(user=user, name='Demo Portfolio')
        holdings = {'DANGCEM': (400, '412.00'), 'MTNN': (2000, '198.50')}
        for sym, (qty, price) in holdings.items():
            inst = Instrument.objects.filter(symbol=sym).first()
            if inst and not PortfolioItem.objects.filter(portfolio=pf, instrument=inst).exists():
                PortfolioItem.objects.create(portfolio=pf, instrument=inst, quantity=qty, purchase_price=Decimal(price))

        for sym, threshold, direction in [('MTNN', '225', 'ABOVE'), ('DANGCEM', '500', 'ABOVE')]:
            inst = Instrument.objects.filter(symbol=sym).first()
            if inst and not Alert.objects.filter(user=user, instrument=inst, alert_type='PRICE').exists():
                Alert.objects.create(user=user, instrument=inst, alert_type='PRICE',
                                     threshold=Decimal(threshold), direction=direction, active=True)

        self.stdout.write(self.style.SUCCESS('Demo data ready: watchlist, portfolio, alerts'))
        self.stdout.write(f'Login: {EMAIL} / {PASSWORD}')
