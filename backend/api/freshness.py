"""Dataset freshness — single source of truth for Naija Finance Hub.

Two callers share this module so they can never disagree:

* ``/api/data-status-public/``        — public status payload for the UI
* ``api.tasks.check_data_freshness``  — hourly ops watchdog

A dataset is STALE when its newest record is older than its threshold.
Thresholds are cadence-based with a floor, so normal scheduler jitter does
not raise false alarms. Auctions are a calendar dataset (a *past* auction is
legitimately weeks old) and get a dedicated long window.
"""
import datetime as _dt

from django.utils import timezone

from .models import AuctionCalendar, FxRate, Fund, MarketIndex, NavSnapshot

# key -> (label, source, advertised cadence in hours)
DATASETS = {
    'market_indexes': ('Market Indexes', 'NGX', 1),
    'cbn_fx': ('CBN FX Rates', 'cbn.gov.ng', 24),
    'dmo_auctions': ('DMO Auctions', 'dmo.gov.ng', 24),
    'sec_nav': ('SEC NAV', 'sec.gov.ng', 168),
}

# Watchdog thresholds: max(cadence * multiplier, floor), unless overridden.
STALE_OVERRIDES_HOURS = {
    # Sovereign auction cycle — the last *past* auction can be weeks old.
    'dmo_auctions': 720,
}

DEFAULT_MULTIPLIER = 2.0
DEFAULT_FLOOR_HOURS = 6


def stale_after_hours(key, multiplier=DEFAULT_MULTIPLIER, floor_hours=DEFAULT_FLOOR_HOURS):
    """Hours of staleness tolerated for a dataset before it is flagged."""
    if key in STALE_OVERRIDES_HOURS:
        return float(STALE_OVERRIDES_HOURS[key])
    cadence = DATASETS.get(key, ('', '', 24))[2]
    return max(cadence * multiplier, floor_hours)


def _age_hours(value):
    """Age in hours of a date/datetime; None when value is None."""
    if value is None:
        return None
    if isinstance(value, _dt.datetime):
        anchor = value
        if timezone.is_naive(anchor):
            anchor = timezone.make_aware(anchor, _dt.timezone.utc)
    else:  # a date — count the record as current through the end of that day
        anchor = timezone.make_aware(
            _dt.datetime.combine(value, _dt.time.max), _dt.timezone.utc
        )
    return round((timezone.now() - anchor).total_seconds() / 3600.0, 1)


def _row(key, last_value, extra=None, multiplier=DEFAULT_MULTIPLIER,
         floor_hours=DEFAULT_FLOOR_HOURS):
    label, source, cadence = DATASETS[key]
    age = _age_hours(last_value)
    threshold = stale_after_hours(key, multiplier, floor_hours)
    row = {
        'key': key,
        'label': label,
        'source': source,
        'last_updated': last_value.isoformat() if last_value is not None else None,
        'cadence_hours': cadence,
        'stale_after_hours': threshold,
        'age_hours': age,
        'is_stale': age is not None and age > threshold,
        'ready': last_value is not None,
    }
    if extra:
        row.update(extra)
    return row


def collect_datasets(multiplier=DEFAULT_MULTIPLIER, floor_hours=DEFAULT_FLOOR_HOURS):
    """Freshness rows for every public dataset, in display order."""
    rows = []

    # Market indexes (NGX) — updated_at is auto_now, hence the newest row.
    idx = MarketIndex.objects.order_by('-updated_at').first()
    rows.append(_row('market_indexes', idx.updated_at if idx else None,
                     multiplier=multiplier, floor_hours=floor_hours))

    # CBN FX
    fx = FxRate.objects.order_by('-date').first()
    rows.append(_row('cbn_fx', fx.date if fx else None,
                     multiplier=multiplier, floor_hours=floor_hours))

    # DMO auctions — "last_updated" is the most recent auction that has already
    # occurred; upcoming scheduled auctions are calendar entries, not updates.
    today = timezone.localdate()
    past = (AuctionCalendar.objects
            .filter(auction_date__lte=today)
            .order_by('-auction_date').first())
    nxt = (AuctionCalendar.objects
           .filter(auction_date__gt=today)
           .order_by('auction_date').first())
    rows.append(_row(
        'dmo_auctions', past.auction_date if past else None,
        extra={'next_auction': nxt.auction_date.isoformat()} if nxt else None,
        multiplier=multiplier, floor_hours=floor_hours,
    ))

    # SEC NAV — coverage honesty: how many active funds carry the latest
    # publication date, so one fresh snapshot cannot mask stale payloads.
    nav = NavSnapshot.objects.order_by('-date').first()
    latest_nav_date = nav.date if nav else None
    nav_extra = {}
    if latest_nav_date:
        nav_extra = {
            'funds_at_latest': (NavSnapshot.objects
                                .filter(fund__is_active=True, date=latest_nav_date)
                                .values('fund').distinct().count()),
            'funds_tracked': Fund.objects.filter(is_active=True).count(),
        }
    rows.append(_row('sec_nav', latest_nav_date, extra=nav_extra,
                     multiplier=multiplier, floor_hours=floor_hours))

    return rows


def freshness_summary(multiplier=DEFAULT_MULTIPLIER, floor_hours=DEFAULT_FLOOR_HOURS):
    """Public payload: dataset rows + staleness rollup + watchdog heartbeat."""
    from .models import DataIngestRun  # local import keeps this module import-light

    datasets = collect_datasets(multiplier, floor_hours)
    stale = [d['key'] for d in datasets if d['is_stale']]
    last_check = (DataIngestRun.objects
                  .filter(source='FRESHNESS')
                  .order_by('-started_at').first())
    return {
        'datasets': datasets,
        'stale_datasets': stale,
        'stale_count': len(stale),
        'checked_at': timezone.now().isoformat(),
        'watchdog': {
            'last_run': last_check.started_at.isoformat() if last_check else None,
            'last_status': last_check.status if last_check else None,
        },
    }
