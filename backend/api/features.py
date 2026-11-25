"""Product feature gates.

EQUITIES_ENABLED is the single switch for the NGX equities layer (stocks,
company profiles, equity earnings, equity watchlist/portfolio rows and
equity alerts). Default is OFF: the public product excludes stocks until
the NGX data licence lands.

Gate at the API layer so hiding a nav link can never be bypassed by a
direct request or a stale client.
"""
from django.conf import settings

EQUITY = 'EQUITY'


def equities_enabled():
    return bool(getattr(settings, 'EQUITIES_ENABLED', False))


def filter_visible_instruments(qs):
    """Drop equity instruments from a queryset unless the gate is open."""
    if equities_enabled():
        return qs
    return qs.exclude(asset_class=EQUITY)


def filter_visible_portfolio_items(qs):
    """Drop portfolio holdings that point at an equity instrument."""
    if equities_enabled():
        return qs
    return qs.exclude(instrument__asset_class=EQUITY)


def is_hidden_equity(instrument):
    return bool(instrument is not None and instrument.asset_class == EQUITY
                and not equities_enabled())


def portfolio_item_visible(item):
    """True when a PortfolioItem may be shown under the current gate."""
    if item.fund_id:
        return True
    if item.instrument_id is None:
        return False
    return not is_hidden_equity(item.instrument)
