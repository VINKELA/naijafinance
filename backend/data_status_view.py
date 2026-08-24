"""Public data-status endpoint (no auth, minimal fields).
   Imported by backend/urls.py for the public API status route."""
from django.http import JsonResponse
from api.models import MarketIndex, FxRate, AuctionCalendar, NavSnapshot

def data_status_public(request):
    """Public dataset freshness — lightweight, no auth required."""
    datasets = []
    
    # Market indexes
    idx = MarketIndex.objects.order_by('-updated_at').first()
    datasets.append({
        'key': 'market_indexes',
        'label': 'Market Indexes',
        'source': 'NGX',
        'last_updated': idx.updated_at.isoformat() if idx and idx.updated_at else None,
        'cadence_hours': 1,
        'ready': idx is not None,
    })
    
    # CBN FX
    fx = FxRate.objects.order_by('-date').first()
    datasets.append({
        'key': 'cbn_fx',
        'label': 'CBN FX Rates',
        'source': 'cbn.gov.ng',
        'last_updated': fx.date.isoformat() if fx else None,
        'cadence_hours': 24,
        'ready': fx is not None,
    })
    
    # DMO Auctions
    # "last_updated" = most recent auction that has already occurred; upcoming
    # scheduled auctions are calendar entries, not data updates.
    from django.utils import timezone as dj_tz
    today = dj_tz.localdate()
    auc = AuctionCalendar.objects.filter(auction_date__lte=today).order_by('-auction_date').first()
    nxt = AuctionCalendar.objects.filter(auction_date__gt=today).order_by('auction_date').first()
    datasets.append({
        'key': 'dmo_auctions',
        'label': 'DMO Auctions',
        'source': 'dmo.gov.ng',
        'last_updated': auc.auction_date.isoformat() if auc else None,
        'cadence_hours': 24,
        'ready': auc is not None,
        **({'next_auction': nxt.auction_date.isoformat()} if nxt else {}),
    })
    
    # SEC NAV
    nav = NavSnapshot.objects.order_by('-date').first()
    datasets.append({
        'key': 'sec_nav',
        'label': 'SEC NAV',
        'source': 'sec.gov.ng',
        'last_updated': nav.date.isoformat() if nav else None,
        'cadence_hours': 168,
        'ready': nav is not None,
    })
    
    return JsonResponse({'datasets': datasets})
