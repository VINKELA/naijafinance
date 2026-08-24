import random
import secrets
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Min, Case, IntegerField, Value, When, OuterRef, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model

User = get_user_model()

# Updated imports to match the new schema
from .models import (
    Exchange, Instrument, Portfolio, PortfolioItem, Watchlist, 
    MarketIndex, PriceHistory, NewsArticle, EarningsCalendar, ScrapeExecution,
    AuctionCalendar, Fund, NavSnapshot, FxRate, CompanyProfile, Alert, MixShare
)
from .serializers import *
from .tasks import run_stateful_scrape
from .display import display_instrument_name, instrument_about_text

# --- Auth & Generic ViewSets ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class InstrumentViewSet(viewsets.ReadOnlyModelViewSet):
    """Publicly viewable instruments (Stocks, Bonds, Forex)"""
    queryset = Instrument.objects.filter(is_active=True)
    serializer_class = InstrumentSerializer
    permission_classes = (permissions.AllowAny,)

class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PortfolioItemViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioItemSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return PortfolioItem.objects.filter(portfolio__user=self.request.user)

    def perform_create(self, serializer):
        portfolio = serializer.validated_data.get('portfolio')
        if portfolio.user != self.request.user:
            raise PermissionDenied("You can only add items to your own portfolios.")
        serializer.save()

class WatchlistViewSet(viewsets.ModelViewSet):
    serializer_class = WatchlistSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Watchlist.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# --- Helpers ---
def instrument_history_rows(instrument):
    rows = list(
        PriceHistory.objects.filter(instrument=instrument)
        .order_by('date')
        .values('date', 'close_price')
    )
    rows = [row for row in rows if row['date'].weekday() < 5]

    if rows and instrument.last_price:
        matching_indexes = [
            index for index, row in enumerate(rows)
            if row['close_price'] == instrument.last_price
        ]
        if matching_indexes and rows[-1]['close_price'] != instrument.last_price:
            rows = rows[:matching_indexes[-1] + 1]

    return rows


def calculate_instrument_performance(instrument):
    """Helper function to calculate actual percentage change from DB history."""
    history = instrument_history_rows(instrument)
    current_price = instrument.last_price or 0
    
    if not history:
        return {"price": current_price, "change_pct": 0, "is_up": True}

    if not current_price:
        current_price = history[-1]['close_price']

    if len(history) < 2:
        return {"price": current_price, "change_pct": 0, "is_up": True}
        
    previous = history[-2]['close_price'] if history[-1]['close_price'] == current_price else history[-1]['close_price']
    
    if previous == 0:
        return {"price": current_price, "change_pct": 0, "is_up": True}
        
    change = current_price - previous
    change_pct = (change / previous) * 100
    
    return {
        "price": current_price,
        "change_pct": round(change_pct, 2),
        "is_up": change >= 0
    }


def format_naira(value):
    return f"₦{Decimal(value):,.2f}"


def decimal_pct(numerator, denominator):
    if not denominator:
        return Decimal('0.00')
    return (Decimal(numerator) / Decimal(denominator)) * Decimal('100')


def to_money_float(value):
    return float(Decimal(value).quantize(Decimal('0.01')))


def instrument_list_row(instrument, index=0):
    colors = ['#174ea6', '#0f766e', '#b3261e', '#7c3aed', '#b06000', '#0b57d0']
    perf = calculate_instrument_performance(instrument)
    sign = "+" if perf['is_up'] else ""
    sector = instrument.issuer.industry_sector if instrument.issuer else instrument.get_asset_class_display()

    return {
        "id": instrument.id,
        "symbol": instrument.symbol,
        "name": display_instrument_name(instrument),
        "sector": sector,
        "price": format_naira(perf['price']),
        "rawPrice": float(perf['price'] or 0),
        "change": f"{sign}{perf['change_pct']}%",
        "changePct": float(perf['change_pct']),
        "isUp": perf['is_up'],
        "color": colors[index % len(colors)],
    }


# --- Dashboard Data Views ---
@api_view(['GET'])
@permission_classes([AllowAny])
def get_top_movers(request):
    category = request.GET.get('type', 'active').lower()
    limit = int(request.GET.get('limit', 8))
    instruments = list(
        Instrument.objects
        .filter(asset_class='EQUITY', last_price__gt=0, is_active=True)
        .select_related('issuer', 'exchange')[:50]
    )

    rows = [instrument_list_row(inst, i) for i, inst in enumerate(instruments)]
    if category == 'gainers':
        rows = sorted(rows, key=lambda item: item['changePct'], reverse=True)
    elif category == 'losers':
        rows = sorted(rows, key=lambda item: item['changePct'])
    else:
        rows = sorted(rows, key=lambda item: abs(item['changePct']), reverse=True)

    return Response(rows[:limit])

@api_view(['GET'])
@permission_classes([AllowAny])
def get_market_trends(request):
    # Grabbing native MarketIndex models
    indexes = MarketIndex.objects.all().order_by('-id')[:5]
    colors = ['#5f6368', '#1a73e8', '#34a853', '#fbbc04', '#ea4335']
    data = []
    for i, index in enumerate(indexes):
        sign = "+" if index.point_change >= 0 else ""
        
        data.append({
            "symbol": index.symbol,
            "name": index.name[:20],
            "price": format_naira(index.current_price),
            "rawPrice": float(index.current_price),
            "change": f"{sign}{index.percent_change}%",
            "changePct": float(index.percent_change),
            "isUp": index.point_change >= 0,
            "color": colors[i % len(colors)]
        })
    return Response(data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_portfolio_summary(request):
    portfolios = Portfolio.objects.prefetch_related('items__instrument').filter(user=request.user)
    
    grand_total = Decimal('0.00')
    items_data = []
    
    for port in portfolios:
        portfolio_total = Decimal('0.00')
        for item in port.items.all():
            if not item.instrument:
                continue
            current_value = item.quantity * (item.instrument.last_price or Decimal('0.00'))
            portfolio_total += current_value
            
        grand_total += portfolio_total
        items_data.append({
            "name": port.name,
            "value": f"₦{portfolio_total:,.2f}"
        })
        
    return Response({
        "total": f"₦{grand_total:,.2f}",
        "items": items_data
    })


def build_portfolio_history(items, grand_total):
    today = timezone.localdate()
    start_date = today - timedelta(days=365)

    quantities_by_instrument = defaultdict(lambda: Decimal('0.00'))
    current_prices = {}
    for item in items:
        if not item.instrument:
            continue
        quantities_by_instrument[item.instrument_id] += item.quantity
        current_prices[item.instrument_id] = item.instrument.last_price or Decimal('0.00')

    instrument_ids = list(quantities_by_instrument.keys())
    if not instrument_ids:
        return []

    seed_prices = {}
    seed_rows = (
        PriceHistory.objects
        .filter(instrument_id__in=instrument_ids, date__lt=start_date)
        .order_by('instrument_id', '-date')
        .values('instrument_id', 'close_price')
    )
    for row in seed_rows:
        seed_prices.setdefault(row['instrument_id'], row['close_price'])

    history_rows = list(
        PriceHistory.objects
        .filter(instrument_id__in=instrument_ids, date__gte=start_date, date__lte=today)
        .order_by('date')
        .values('instrument_id', 'date', 'close_price')
    )

    rows_by_date = defaultdict(list)
    for row in history_rows:
        rows_by_date[row['date']].append(row)

    dates = sorted(rows_by_date.keys())
    if today not in dates:
        dates.append(today)

    last_prices = {
        instrument_id: seed_prices.get(instrument_id, current_prices.get(instrument_id, Decimal('0.00')))
        for instrument_id in instrument_ids
    }

    points = []
    for point_date in sorted(dates):
        for row in rows_by_date.get(point_date, []):
            last_prices[row['instrument_id']] = row['close_price']

        if point_date == today:
            last_prices.update(current_prices)

        value = sum(
            quantities_by_instrument[instrument_id] * last_prices.get(instrument_id, Decimal('0.00'))
            for instrument_id in instrument_ids
        )
        points.append({"date": point_date.strftime('%Y-%m-%d'), "value": to_money_float(value)})

    if not points:
        points = [{"date": today.strftime('%Y-%m-%d'), "value": to_money_float(grand_total)}]

    max_points = 120
    if len(points) <= max_points:
        return points

    sampled = []
    last_index = len(points) - 1
    for index in range(max_points):
        sampled.append(points[round((index * last_index) / (max_points - 1))])

    deduped = []
    seen_dates = set()
    for point in sampled:
        if point['date'] not in seen_dates:
            deduped.append(point)
            seen_dates.add(point['date'])

    return deduped


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_portfolio_insights(request):
    portfolios = (
        Portfolio.objects
        .filter(user=request.user)
        .prefetch_related('items__instrument__issuer', 'items__instrument__exchange')
    )

    colors = ['#174ea6', '#0f766e', '#b3261e', '#7c3aed', '#b06000', '#0b57d0', '#c5221f', '#188038']
    grand_total = Decimal('0.00')
    total_cost = Decimal('0.00')
    stock_totals = {}
    portfolio_breakdown = []
    all_items = []

    for portfolio in portfolios:
        portfolio_value = Decimal('0.00')
        portfolio_cost = Decimal('0.00')
        holding_count = 0

        for item in portfolio.items.all():
            if not item.instrument:
                continue

            all_items.append(item)
            holding_count += 1
            quantity = item.quantity or Decimal('0.00')
            current_price = item.instrument.last_price or Decimal('0.00')
            cost = quantity * (item.purchase_price or Decimal('0.00'))
            value = quantity * current_price

            portfolio_value += value
            portfolio_cost += cost

            stock_key = item.instrument_id
            if stock_key not in stock_totals:
                stock_totals[stock_key] = {
                    "symbol": item.instrument.symbol,
                    "name": display_instrument_name(item.instrument),
                    "quantity": Decimal('0.00'),
                    "currentPrice": current_price,
                    "value": Decimal('0.00'),
                    "cost": Decimal('0.00'),
                    "portfolioNames": set(),
                }

            stock_totals[stock_key]["quantity"] += quantity
            stock_totals[stock_key]["value"] += value
            stock_totals[stock_key]["cost"] += cost
            stock_totals[stock_key]["currentPrice"] = current_price
            stock_totals[stock_key]["portfolioNames"].add(portfolio.name)

        gain_loss = portfolio_value - portfolio_cost
        portfolio_breakdown.append({
            "id": portfolio.id,
            "name": portfolio.name,
            "holdingCount": holding_count,
            "value": to_money_float(portfolio_value),
            "cost": to_money_float(portfolio_cost),
            "gainLoss": to_money_float(gain_loss),
            "gainLossPct": float(decimal_pct(gain_loss, portfolio_cost)),
            "formattedValue": format_naira(portfolio_value),
            "formattedGainLoss": format_naira(gain_loss),
        })

        grand_total += portfolio_value
        total_cost += portfolio_cost

    total_gain_loss = grand_total - total_cost
    contributions = []
    for index, contribution in enumerate(sorted(stock_totals.values(), key=lambda row: row["value"], reverse=True)):
        value = contribution["value"]
        cost = contribution["cost"]
        gain_loss = value - cost
        quantity = contribution["quantity"]
        average_cost = cost / quantity if quantity else Decimal('0.00')

        contributions.append({
            "symbol": contribution["symbol"],
            "name": contribution["name"],
            "quantity": float(quantity),
            "currentPrice": to_money_float(contribution["currentPrice"]),
            "averageCost": to_money_float(average_cost),
            "value": to_money_float(value),
            "cost": to_money_float(cost),
            "gainLoss": to_money_float(gain_loss),
            "gainLossPct": float(decimal_pct(gain_loss, cost)),
            "weightPct": float(decimal_pct(value, grand_total)),
            "formattedValue": format_naira(value),
            "formattedGainLoss": format_naira(gain_loss),
            "portfolios": sorted(contribution["portfolioNames"]),
            "color": colors[index % len(colors)],
        })

    return Response({
        "asOf": timezone.localdate().strftime('%Y-%m-%d'),
        "portfolioCount": len(portfolio_breakdown),
        "holdingCount": len(all_items),
        "totals": {
            "value": to_money_float(grand_total),
            "cost": to_money_float(total_cost),
            "gainLoss": to_money_float(total_gain_loss),
            "gainLossPct": float(decimal_pct(total_gain_loss, total_cost)),
            "formattedValue": format_naira(grand_total),
            "formattedCost": format_naira(total_cost),
            "formattedGainLoss": format_naira(total_gain_loss),
        },
        "history": build_portfolio_history(all_items, grand_total),
        "contributions": contributions,
        "byPortfolio": portfolio_breakdown,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_news(request):
    limit = int(request.GET.get('limit', 12))
    articles = NewsArticle.objects.all()[:limit]
    data = []
    for article in articles:
        delta = timezone.now() - article.published_at
        hours = delta.total_seconds() // 3600
        time_str = f"{int(hours)} hours ago" if hours > 0 else "Just now"
        
        data.append({
            "source": article.source,
            "time": time_str,
            "title": article.title,
            "url": article.url or "",
            "published_at": article.published_at,
        })
    return Response(data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_earnings(request):
    limit = int(request.GET.get('limit', 12))
    upcoming = EarningsCalendar.objects.select_related('instrument').filter(report_date__gte=timezone.now())[:limit]
    data = []
    for event in upcoming:
        data.append({
            "symbol": event.instrument.symbol,
            "month": event.report_date.strftime("%b"),
            "day": event.report_date.strftime("%d"),
            "name": display_instrument_name(event.instrument),
            "time": event.report_date.strftime("%b %d, %Y"),
            "report_date": event.report_date,
        })
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def market_overview(request):
    indexes = MarketIndex.objects.all()
    equities = list(Instrument.objects.filter(asset_class='EQUITY', is_active=True, last_price__gt=0))
    rows = [instrument_list_row(inst, i) for i, inst in enumerate(equities)]
    gainers = sorted(rows, key=lambda item: item['changePct'], reverse=True)[:3]
    losers = sorted(rows, key=lambda item: item['changePct'])[:3]
    market_value = sum([index.current_price for index in indexes], Decimal('0.00'))
    positive = len([row for row in rows if row['isUp']])

    return Response({
        "indexCount": indexes.count(),
        "instrumentCount": len(equities),
        "positiveCount": positive,
        "negativeCount": max(len(equities) - positive, 0),
        "marketValue": format_naira(market_value),
        "topGainers": gainers,
        "topLosers": losers,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def default_watchlist(request):
    watchlist = Watchlist.objects.filter(user=request.user).first()
    if watchlist is None:
        watchlist = Watchlist.objects.create(user=request.user, name='My Watchlist')
    return Response(WatchlistSerializer(watchlist).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def portfolio_performance(request, pk):
    """Value-over-time series for one portfolio (instruments via PriceHistory, funds via NAV).

    Period: 30/90/180/365 days (default 90). Display-only.
    Each item contributes only from its own inception (S6); funds whose
    inception had to be derived from data are listed in items_missing_inception.
    """
    portfolio = get_object_or_404(Portfolio, pk=pk, user=request.user)
    period = int(request.query_params.get('period', 90))
    if period not in (30, 90, 180, 365):
        period = 90
    points, missing_inception = build_portfolio_value_series(portfolio, period, with_meta=True)
    return Response({
        "period_days": period,
        "points": points,
        "items_missing_inception": missing_inception,
    })


def _mix_card_rows(portfolio, item_ids=None):
    """Sanitized allocation-level rows: symbol, class, value, pct. NO quantities,
    NO cost basis, NO P&L, NO user identity — the public Asset Mix contract.

    item_ids (optional): only these PortfolioItem ids are included, so a user
    can share a single asset or a chosen subset instead of the whole portfolio.
    """
    qs = portfolio.items.all()
    if item_ids:
        qs = qs.filter(id__in=item_ids)
    items = list(qs)
    total = Decimal('0.00')
    rows = []
    for it in items:
        if it.fund_id:
            latest = it.fund.nav_snapshots.order_by('-date').first()
            price = latest.nav if latest else Decimal('0.00')
            symbol = it.fund.name
            cls = f"Fund · {it.fund.get_asset_class_display()}"
        elif it.instrument_id:
            price = it.instrument.last_price or Decimal('0.00')
            symbol = it.instrument.symbol
            cls = it.instrument.get_asset_class_display()
        else:
            continue
        value = (price or Decimal('0.00')) * it.quantity
        total += value
        rows.append({"symbol": symbol, "asset_class": cls, "value": float(value)})
    rows.sort(key=lambda r: r['value'], reverse=True)
    for r in rows:
        r['pct'] = round((r['value'] / float(total) * 100) if total else 0, 1)
    return total, rows



@api_view(['GET'])
@permission_classes([AllowAny])
def mix_card(request, token):
    """Public card data for a shared Asset Mix (no login).

    Serves the frozen snapshot captured at share time, so the card remains
    public and stable even after the source portfolio is deleted.
    """
    share = get_object_or_404(MixShare, token=token)
    if share.visibility == 'private' and request.user != share.user:
        return Response({'detail': 'Mix not found.'}, status=404)
    snap = share.snapshot or {}
    if snap.get('items'):
        return Response(snap)
    # Legacy shares (pre-snapshot): compute a sanitized view live.
    if share.portfolio_id:
        total, rows = _mix_card_rows(share.portfolio)
        return Response({
            "name": share.portfolio.name,
            "asOf": timezone.localdate().isoformat(),
            "totalValue": float(total),
            "items": rows,
        })
    return Response({"name": "Asset Mix", "asOf": timezone.localdate().isoformat(), "totalValue": 0, "items": []})


def build_mix_value_series(snapshot, period_days=90, with_meta=False):
    """Aggregate value-over-time for a standalone Asset Mix (frozen snapshot).

    Each snapshot item carries {symbol, class, value}. Instruments (stocks,
    bonds, CPs, FX) are priced from PriceHistory close prices; fund rows use
    NavSnapshot NAVs. Quantity is implied from the allocated value at the
    latest price, so the series is a true aggregate in NGN.

    S6: each item contributes only from its OWN inception — max(asset/fund
    inception date, period start) — never forward-filled across the whole
    window. Fund model has no inception_date field yet, so the earliest
    NavSnapshot date stands in and such items are reported via the
    items_missing_inception list.

    Returns [{date, value}] oldest-first; with with_meta=True returns
    (points, items_missing_inception).
    """
    today = timezone.localdate()
    start = today - timedelta(days=period_days)
    items = (snapshot or {}).get('items') or []
    if not items:
        return ([], []) if with_meta else []

    resolved = []  # (qty, {date: price}, contributes_from)
    flat_value = Decimal('0.00')
    missing_inception = []
    for it in items:
        value = Decimal(str(it.get('value') or '0'))
        if value <= 0:
            continue
        symbol = (it.get('symbol') or '').strip()
        if not symbol:
            continue
        inst = Instrument.objects.filter(symbol__iexact=symbol, is_active=True).first()
        series = {}
        inception = None
        if inst:
            # Instrument inception: first day it has published prices.
            inception = (
                PriceHistory.objects.filter(instrument=inst)
                .aggregate(first_date=Min('date'))['first_date']
            )
            rows = list(
                PriceHistory.objects
                .filter(instrument=inst, date__gte=start, date__lte=today)
                .order_by('date')
                .values('date', 'close_price')
            )
            for r in rows:
                series[r['date']] = float(r['close_price'] or 0)
        else:
            fund = Fund.objects.filter(name=symbol).first()
            if fund:
                # No explicit inception_date field on Fund yet (S6): fall back
                # to the earliest NavSnapshot and flag it as missing inception.
                inception = (
                    NavSnapshot.objects.filter(fund=fund)
                    .aggregate(first_nav_date=Min('date'))['first_nav_date']
                )
                if inception:
                    missing_inception.append({"fund": fund.name})
                rows = list(
                    NavSnapshot.objects
                    .filter(fund=fund, date__gte=start, date__lte=today)
                    .order_by('date')
                    .values('date', 'nav')
                )
                for r in rows:
                    series[r['date']] = float(r['nav'] or 0)
        if series:
            last = series[max(series)]
            qty = value / Decimal(str(last)) if last else Decimal('0.00')
            if qty > 0:
                # Contribute only from own inception, clamped to period start.
                contributes_from = max(inception, start) if inception else start
                resolved.append((qty, series, contributes_from))
                continue
        # Un-priced or unresolved: hold flat at the allocated value
        flat_value += value

    all_dates = sorted({d for _, s, _ in resolved for d in s})
    if not all_dates:
        points = []
        if flat_value:
            points = [
                {"date": start.isoformat(), "value": round(float(flat_value), 2)},
                {"date": today.isoformat(), "value": round(float(flat_value), 2)},
            ]
        return (points, missing_inception) if with_meta else points

    last_px = {}
    points = []
    for d in all_dates:
        for i, (_, s, contributes_from) in enumerate(resolved):
            if d < contributes_from:
                continue  # before this item's inception: no contribution, no carry-forward
            if d in s:
                last_px[i] = s[d]
        total = flat_value
        for i, (qty, _, _) in enumerate(resolved):
            px = last_px.get(i)
            if px is not None:
                total += qty * Decimal(str(px))
        points.append({"date": d.isoformat(), "value": round(float(total), 2)})
    return (points, missing_inception) if with_meta else points


@api_view(['GET'])
@permission_classes([AllowAny])
def mix_performance(request, token):
    """Public value-over-time series for a shared Asset Mix (no login)."""
    share = get_object_or_404(MixShare, token=token)
    period = int(request.query_params.get('period', 90))
    if period not in (30, 90, 180, 365):
        period = 90
    if share.portfolio_id:
        points, missing_inception = build_portfolio_value_series(share.portfolio, period, with_meta=True)
    else:
        points, missing_inception = build_mix_value_series(share.snapshot, period, with_meta=True)
    return Response({
        "period_days": period,
        "points": points,
        "items_missing_inception": missing_inception,
    })

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_mix_share(request):
    """Create a public 'Asset Mix' share card from one of the user's portfolios."""
    portfolio_id = request.data.get('portfolio_id')
    portfolio = get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
    token = secrets.token_hex(6)
    share = MixShare.objects.create(token=token, user=request.user, portfolio=portfolio)
    return Response({"token": token, "url": f"/asset-mix?token={token}"}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def watchlist_history(request):
    """Aggregated performance series for the user's watched instruments + funds.

    Returns [{date, value}] where value = average % change vs period start,
    across all watched instruments (PriceHistory) and funds (NAV history).
    Period: 7/30/90/365 days (default 90). Display-only, demo data.
    """
    period = int(request.query_params.get('period', 90))
    if period not in (7, 30, 90, 365):
        period = 90
    watchlist = Watchlist.objects.filter(user=request.user).first()
    if watchlist is None:
        watchlist = Watchlist.objects.create(user=request.user, name='My Watchlist')

    today = timezone.localdate()
    start = today - timedelta(days=period)

    series = defaultdict(list)  # date -> [pct changes]

    for inst in watchlist.instruments.filter(is_active=True):
        rows = list(
            PriceHistory.objects.filter(instrument=inst, date__gte=start, date__lte=today)
            .order_by('date')
            .values('date', 'close_price')
        )
        if len(rows) < 2:
            continue
        base = float(rows[0]['close_price']) or 0.0
        if base <= 0:
            continue
        for row in rows:
            pct = (float(row['close_price']) / base - 1.0) * 100.0
            series[row['date']].append(pct)

    for fund in watchlist.funds.filter(is_active=True):
        navs = list(
            fund.nav_snapshots.filter(date__gte=start, date__lte=today)
            .order_by('date')
            .values('date', 'nav')
        )
        if len(navs) < 2:
            continue
        base = float(navs[0]['nav']) or 0.0
        if base <= 0:
            continue
        for row in navs:
            pct = (float(row['nav']) / base - 1.0) * 100.0
            series[row['date']].append(pct)

    points = [
        {"date": d.isoformat(), "value": round(sum(v) / len(v), 3)}
        for d, v in sorted(series.items())
    ]
    return Response({"period_days": period, "points": points})



@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_watchlist(request):
    watchlist, _ = Watchlist.objects.get_or_create(user=request.user, name='My Watchlist')
    fund_id = request.data.get('fund_id')
    if fund_id:
        fund = get_object_or_404(Fund, id=fund_id)
        if watchlist.funds.filter(id=fund.id).exists():
            watchlist.funds.remove(fund)
            added = False
        else:
            watchlist.funds.add(fund)
            added = True
        return Response({
            "added": added,
            "kind": "fund",
            "watchlist": WatchlistSerializer(watchlist).data,
        })

    symbol = request.data.get('symbol', '').strip()
    if not symbol:
        return Response({"detail": "symbol or fund_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    instrument = get_object_or_404(Instrument, symbol__iexact=symbol)
    if watchlist.instruments.filter(id=instrument.id).exists():
        watchlist.instruments.remove(instrument)
        added = False
    else:
        watchlist.instruments.add(instrument)
        added = True

    return Response({
        "added": added,
        "kind": "instrument",
        "watchlist": WatchlistSerializer(watchlist).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_portfolio_item_by_symbol(request):
    portfolio_id = request.data.get('portfolio_id')
    symbol = request.data.get('symbol', '').strip()
    quantity = request.data.get('quantity')
    purchase_price = request.data.get('purchase_price')

    fund_id = request.data.get('fund_id')
    if not all([portfolio_id, quantity, purchase_price]) or not (symbol or fund_id):
        return Response(
            {"detail": "portfolio_id, quantity, purchase_price, and symbol or fund_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    portfolio = get_object_or_404(Portfolio, id=portfolio_id, user=request.user)
    if fund_id:
        fund = get_object_or_404(Fund, id=fund_id)
        item = PortfolioItem.objects.create(
            portfolio=portfolio,
            fund=fund,
            quantity=Decimal(str(quantity)),
            purchase_price=Decimal(str(purchase_price)),
        )
    else:
        instrument = get_object_or_404(Instrument, symbol__iexact=symbol)
        item = PortfolioItem.objects.create(
            portfolio=portfolio,
            instrument=instrument,
            quantity=Decimal(str(quantity)),
            purchase_price=Decimal(str(purchase_price)),
        )
    return Response(PortfolioItemSerializer(item).data, status=status.HTTP_201_CREATED)


# --- Scrape Job Views ---
@api_view(['POST'])
@permission_classes([AllowAny])
def trigger_scrape(request):
    target_url = request.data.get('target_url')
    if not target_url:
        return Response({"detail": "target_url is required."}, status=status.HTTP_400_BAD_REQUEST)

    # G3 COMPLIANCE (2026-08-03): CSCS login scraping is retired. Reject
    # any attempt to schedule a CSCS scrape regardless of env flags.
    if 'cscs.ng' in (target_url or '').lower():
        return Response(
            {"detail": "CSCS login scraping is retired (G3 compliance). Public free data sources only."},
            status=status.HTTP_403_FORBIDDEN,
        )

    execution = ScrapeExecution.objects.create(target_url=target_url)
    try:
        run_stateful_scrape.delay(execution.id)
    except Exception as exc:
        execution.status = 'FAILED'
        execution.error_message = str(exc)
        execution.save(update_fields=['status', 'error_message', 'updated_at'])
        return Response(
            {"job_id": execution.id, "status": execution.status, "error": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"job_id": execution.id, "status": execution.status}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_scrape_status(request, job_id):
    execution = get_object_or_404(ScrapeExecution, id=job_id)
    counts = {
        "pending": execution.symbols.filter(status='PENDING').count(),
        "completed": execution.symbols.filter(status='COMPLETED').count(),
        "failed": execution.symbols.filter(status='FAILED').count(),
    }
    return Response({
        "job_id": execution.id,
        "target_url": execution.target_url,
        "status": execution.status,
        "error_message": execution.error_message,
        "counts": counts,
    })


# --- Detail & Search Views ---
@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_detail(request, symbol):
    # Upgraded to use Instrument table
    instrument = get_object_or_404(Instrument, symbol__iexact=symbol)
    
    history_rows = instrument_history_rows(instrument)
    
    perf = calculate_instrument_performance(instrument)
    
    previous_price = history_rows[-2]['close_price'] if len(history_rows) > 1 and history_rows[-1]['close_price'] == perf['price'] else (
        history_rows[-1]['close_price'] if history_rows else perf['price']
    )
    change_amt = perf['price'] - previous_price
    
    chart_data = [{"date": h['date'].strftime('%Y-%m-%d'), "price": float(h['close_price'])} for h in history_rows]
    if chart_data and instrument.last_price and history_rows[-1]['close_price'] != instrument.last_price:
        chart_data.append({
            "date": timezone.now().strftime('%Y-%m-%d'),
            "price": float(instrument.last_price),
        })
    
    if not chart_data:
        today = timezone.now().strftime('%Y-%m-%d')
        chart_data = [{"date": today, "price": float(perf['price'])}, {"date": today, "price": float(perf['price'])}]

    raw_prices = [item['price'] for item in chart_data]

    stats = [
        {"label": "Previous close", "value": f"₦{previous_price:,.2f}"},
        {"label": "52-wk high", "value": f"₦{max(raw_prices):,.2f}" if raw_prices else "N/A"},
        {"label": "52-wk low", "value": f"₦{min(raw_prices):,.2f}" if raw_prices else "N/A"},
    ]
    if instrument.maturity_date:
        stats.append({"label": "Maturity", "value": instrument.maturity_date.isoformat()})
    if instrument.coupon_rate is not None:
        stats.append({"label": "Coupon", "value": f"{float(instrument.coupon_rate) * 100:.2f}%"})
    if instrument.issuer_id and instrument.issuer.name:
        stats.append({"label": "Issuer", "value": instrument.issuer.name})

    data = {
        "id": instrument.id,
        "symbol": instrument.symbol,
        "name": display_instrument_name(instrument),
        "price": f"{perf['price']:,.2f}",
        "changeAmt": f"{abs(change_amt):.2f}",
        "changePct": f"{abs(perf['change_pct']):.2f}",
        "isUp": perf['is_up'],
        "exchange": instrument.exchange.name if instrument.exchange else "OTC",
        "asset_type": instrument.get_asset_class_display(),
        "about": instrument_about_text(instrument),
        "chart_data": chart_data,
        "stats": stats,
        "news": []
    }

    return Response(data)

# --- S2: Fund info endpoint (frozen 15-field schema with provenance) ---

SOURCE_PENDING = "pending_data_acquisition"

# The frozen 15-field fund-info schema. Each field is reported as
# {"value": <value or null>, "source": <provenance>}. A null value is honest:
# it means the data has not been acquired yet — never a guessed placeholder.
# Fields without a live ingestion pipeline yet are attributed
# 'manual_admin_entry' when populated by hand; they must NEVER be auto-filled.
FUND_INFO_FIELDS = [
    # (field name on Fund, source attribution when a value exists)
    ('name', 'fund_manager_publication'),
    ('manager', 'fund_manager_publication'),
    ('asset_class', 'fund_manager_publication'),
    ('registrar_trustee', 'manual_admin_entry'),
    ('custodian', 'manual_admin_entry'),
    ('update_cadence', 'manual_admin_entry'),
    ('inception_date', 'manual_admin_entry'),
    ('benchmark', 'manual_admin_entry'),
    ('fee_breakdown', 'manual_admin_entry'),
    ('aum', 'manual_admin_entry'),
    ('minimum_investment', 'manual_admin_entry'),
    ('fact_sheet_url', 'manual_admin_entry'),
    ('sec_registration_status', 'manual_admin_entry'),
    ('risk_profile', 'manual_admin_entry'),
]


@api_view(['GET'])
@permission_classes([AllowAny])
def fund_info(request, pk):
    """Full 15-field fund-info payload with per-field source attribution.

    Data honesty rule: where no real data exists yet, "value" is null and
    "source" is "pending_data_acquisition". Values are never fabricated.
    latest_nav / nav_history are included unchanged for convenience.
    """
    fund = get_object_or_404(Fund, id=pk, is_active=True)

    info = {}
    for field_name, source_with_value in FUND_INFO_FIELDS:
        value = getattr(fund, field_name)
        if value is None or value == '':
            info[field_name] = {"value": None, "source": SOURCE_PENDING}
        else:
            if isinstance(value, Decimal):
                value = str(value)  # exact decimal text; no float rounding
            elif hasattr(value, 'isoformat'):
                value = value.isoformat()
            info[field_name] = {"value": value, "source": source_with_value}
    # currency defaults to NGN at the model level; attribute honestly.
    info['currency'] = {
        "value": fund.currency or None,
        "source": 'system_default' if (fund.currency or '') == 'NGN' else 'fund_manager_publication',
    }

    return Response({
        "id": fund.id,
        **info,
        "latest_nav": FundSerializer(fund).data.get('latest_nav'),
        "nav_history": FundSerializer(fund).data.get('nav_history'),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_fund_detail(request, pk):
    fund = get_object_or_404(Fund, id=pk, is_active=True)
    navs = list(fund.nav_snapshots.order_by('date'))
    series = [{"date": n.date.isoformat(), "value": float(n.nav)} for n in navs]
    latest = navs[-1] if navs else None
    first = navs[0] if navs else None
    pct = None
    if latest and first and float(first.nav):
        pct = round((float(latest.nav) / float(first.nav) - 1) * 100, 2)
    return Response({
        "id": fund.id,
        "symbol": fund.name,
        "name": fund.name,
        "kind": "fund",
        "asset_type": f"Fund · {fund.get_asset_class_display()}",
        "manager": fund.manager or "—",
        "price": f"{float(latest.nav):,.4f}" if latest else "—",
        "changePct": f"{pct:.2f}" if pct is not None else "—",
        "isUp": (pct or 0) >= 0,
        "about": f"{fund.name} is a {fund.get_asset_class_display()} mutual fund managed by {fund.manager or 'the fund manager'}. NAV shown is the latest published snapshot.",
        "chart_data": series,
        "stats": [
            {"label": "Latest NAV", "value": f"₦{float(latest.nav):,.4f}" if latest else "—"},
            {"label": "NAV date", "value": latest.date.isoformat() if latest else "—"},
            {"label": "Manager", "value": fund.manager or "—"},
            {"label": "Class", "value": fund.get_asset_class_display()},
        ],
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_company_detail(request, symbol):
    company = get_object_or_404(CompanyProfile, symbol__iexact=symbol, is_active=True)
    revenue = [
        {"date": f"{r['year']}-01-01", "value": float(r['revenue_ngn'])}
        for r in (company.revenue_history or [])
        if r.get('revenue_ngn')
    ]
    return Response({
        "id": company.id,
        "symbol": company.symbol,
        "name": company.name,
        "kind": "company",
        "asset_type": f"Company · {company.sector or '—'}",
        "price": "—",
        "changePct": "—",
        "isUp": True,
        "about": company.description or f"{company.name} — public company profile (display only).",
        "chart_data": revenue,
        "stats": [
            {"label": "Sector", "value": company.sector or "—"},
            {"label": "EPS", "value": str(company.eps) if company.eps is not None else "—"},
            {"label": "P/E", "value": str(company.pe_ratio) if company.pe_ratio is not None else "—"},
            {"label": "Book value", "value": str(company.book_value) if company.book_value is not None else "—"},
            {"label": "Market cap (₦)", "value": f"{float(company.market_cap):,.0f}" if company.market_cap else "—"},
        ],
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def search_stocks(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response([])

    instruments = Instrument.objects.filter(
        is_active=True
    ).filter(
        Q(symbol__icontains=query) | Q(name__icontains=query)
    ).annotate(
        search_rank=Case(
            When(symbol__iexact=query, then=Value(0)),
            When(
                Q(asset_class='EQUITY')
                & Q(symbol__istartswith=query)
                & ~Q(name__istartswith='CSCS:')
                & ~Q(name__istartswith='Nigerian Exchange:'),
                then=Value(1),
            ),
            When(
                Q(asset_class='EQUITY')
                & Q(name__icontains=query)
                & ~Q(name__istartswith='CSCS:')
                & ~Q(name__istartswith='Nigerian Exchange:'),
                then=Value(2),
            ),
            When(asset_class='EQUITY', symbol__istartswith=query, then=Value(3)),
            When(symbol__istartswith=query, then=Value(4)),
            default=Value(5),
            output_field=IntegerField(),
        )
    ).order_by('search_rank', 'symbol')[:10]
    
    data = [
        {
            "symbol": inst.symbol,
            "name": display_instrument_name(inst),
            "type": inst.get_asset_class_display(),
            "price": float(inst.last_price or 0),
        }
        for inst in instruments
    ]
    return Response(data)

class MarketIndexListView(generics.ListAPIView):
    """Returns a list of all market indexes to populate the trend cards."""
    queryset = MarketIndex.objects.all()
    serializer_class = MarketIndexSerializer

class MarketIndexDetailView(generics.RetrieveAPIView):
    """Returns a single index for the detailed graph page."""
    queryset = MarketIndex.objects.all()
    serializer_class = MarketIndexSerializer
    lookup_field = 'symbol'

# ==========================================
# Free public data layer views
# ==========================================
# Public read endpoints below serve is_active rows only. User-scoped
# endpoints use request.user. Data is display/education only and is never
# investment advice.

DISCLAIMER = (
    "All data on this page is provided for information and education only "
    "and does not constitute investment advice."
)


class BondInstrumentViewSet(viewsets.ReadOnlyModelViewSet):
    """Public FGN bond / fixed-income instruments."""
    serializer_class = InstrumentSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        return Instrument.objects.filter(asset_class='BOND', is_active=True)


class CommercialPaperViewSet(viewsets.ReadOnlyModelViewSet):
    """Short-term corporate debt instruments (discount notes)."""
    serializer_class = InstrumentSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        return Instrument.objects.filter(asset_class='COMMERCIAL_PAPER', is_active=True)


class AuctionCalendarViewSet(viewsets.ReadOnlyModelViewSet):
    """Public DMO auction calendar & results."""
    serializer_class = AuctionCalendarSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        qs = AuctionCalendar.objects.filter(is_active=True).select_related('instrument')
        instrument = self.request.query_params.get('instrument')
        if instrument:
            qs = qs.filter(instrument_id=instrument)
        return qs


class FundViewSet(viewsets.ReadOnlyModelViewSet):
    """Public mutual fund list + published NAV snapshots."""
    serializer_class = FundSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        return Fund.objects.filter(is_active=True).prefetch_related('nav_snapshots')


class FxRateViewSet(viewsets.ReadOnlyModelViewSet):
    """Public CBN published FX rates."""
    serializer_class = FxRateSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        qs = FxRate.objects.filter(is_active=True)
        pair = self.request.query_params.get('pair')
        if pair:
            qs = qs.filter(pair__iexact=pair)
        if self.request.query_params.get('latest') in ('1', 'true', 'True'):
            latest_dates = FxRate.objects.filter(pair=OuterRef('pair')).order_by('-date')
            qs = qs.filter(date=Subquery(latest_dates.values('date')[:1]))
        return qs


class CompanyProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """Public company profiles + fundamentals (display only)."""
    serializer_class = CompanyProfileSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        return CompanyProfile.objects.filter(is_active=True)


class AlertViewSet(viewsets.ModelViewSet):
    """User-scoped threshold alerts (CRUD)."""
    serializer_class = AlertSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Alert.objects.filter(user=self.request.user).select_related('instrument', 'fund')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Ensure users can never retarget someone else's alert via update.
        if self.get_object().user != self.request.user:
            raise PermissionDenied("You can only update your own alerts.")
        serializer.save()


# ---- Direct Login (bypasses Django 6.0 authenticate() gunicorn bug) ----
from rest_framework_simplejwt.tokens import RefreshToken



@api_view(['POST'])
@permission_classes([AllowAny])
def direct_login(request):
    email = request.data.get('email', '')
    password = request.data.get('password', '')
    if not email or not password:
        return Response({'detail': 'Email and password required.'}, status=400)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'detail': 'No active account found with the given credentials'}, status=401)
    if not user.is_active or not user.check_password(password):
        return Response({'detail': 'No active account found with the given credentials'}, status=401)
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    })


# ---- OTP (One-Time Code) Auth ----
import random, time, threading
from django.core.cache import cache
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

OTP_LENGTH = 6
OTP_TTL = 600  # 10 minutes

def _generate_otp():
    return ''.join(random.choices('0123456789', k=OTP_LENGTH))

# Branded HTML email template (NaijaFinance Hub green #0D7C3E)
OTP_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif">
<table width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
<tr><td align="center">
<table width="100%%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
  <!-- Header -->
  <tr><td style="background:#0D7C3E;padding:28px 32px;text-align:center">
    <div style="display:inline-block;width:48px;height:48px;background:#ffffff;border-radius:12px;line-height:48px;text-align:center">
      <span style="color:#0D7C3E;font-size:22px;font-weight:800;letter-spacing:1px">NF</span>
    </div>
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:16px 0 0;letter-spacing:-0.3px">NaijaFinance Hub</h1>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px">
    <p style="margin:0 0 12px;font-size:16px;color:#1a1a2e;font-weight:600">Your sign-in code</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">Enter this 6-digit code on the sign-in page to access your account. This code expires in 10 minutes.</p>
    <!-- Code box -->
    <div style="background:#f0f7f2;border:1px solid #0D7C3E;border-radius:12px;padding:18px;text-align:center;margin:0 0 24px">
      <span style="font-size:32px;font-weight:800;letter-spacing:12px;color:#0D7C3E;font-family:'SF Mono',Monaco,'Cascadia Code',monospace">{code}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.6">If you did not request this code, you can safely ignore this email. No action is needed.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#999;text-align:center">NaijaFinance Hub — Nigerian Markets, One Dashboard<br>&copy; 2026 NaijaFinance Hub. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>"""

def _send_otp_email_async(email, code):
    """Send branded OTP email in a background thread to avoid blocking the API response."""
    try:
        html_body = OTP_EMAIL_HTML.format(code=code)
        msg = EmailMultiAlternatives(
            subject='%s — your sign-in code for NaijaFinance Hub' % code,
            body='Your NaijaFinance Hub verification code is: %s\n\nEnter this code on the sign-in page. It expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.' % code,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'hello@naijafinancehub.com'),
            to=[email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
    except Exception as e:
        import logging
        logging.getLogger('otp').error('Failed to send OTP to %s: %s', email, e)

@api_view(['POST'])
@permission_classes([AllowAny])
def request_login_code(request):
    email = (request.data.get('email') or '').strip().lower()
    first_name = (request.data.get('first_name') or '').strip()
    last_name = (request.data.get('last_name') or '').strip()
    if not email:
        return Response({'error': 'Email is required.'}, status=400)
    is_registration = bool(first_name and last_name)
    user_exists = User.objects.filter(email=email).exists()
    # Sign-in: reject unregistered emails
    if not is_registration and not user_exists:
        return Response({'ok': False, 'error': 'No account found with this email. Please register first.'})
    # Registration: reject already-registered emails
    if is_registration and user_exists:
        return Response({'ok': False, 'error': 'An account with this email already exists. Sign in instead.'})
    code = _generate_otp()
    cache.set(f'otp:{email}', code, timeout=OTP_TTL)
    # Fire-and-forget: send email in background thread (async — does not block API response)
    threading.Thread(target=_send_otp_email_async, args=(email, code), daemon=True).start()
    # Fallback log
    with open('/tmp/otp_codes.log', 'a') as f:
        f.write(f'{time.time()}|{email}|{code}\n')
    return Response({'ok': True, 'message': 'Code sent.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_login_code(request):
    email = (request.data.get('email') or '').strip().lower()
    code = (request.data.get('code') or '').strip()
    first_name = (request.data.get('first_name') or '').strip()
    last_name = (request.data.get('last_name') or '').strip()
    if not email or not code:
        return Response({'error': 'Email and code are required.'}, status=400)
    stored = cache.get(f'otp:{email}')
    if stored is None or stored != code:
        return Response({'error': 'Invalid or expired code.'}, status=401)
    cache.delete(f'otp:{email}')
    # Get or create user
    user, created = User.objects.get_or_create(email=email, defaults={
        'first_name': first_name or email.split('@')[0],
        'last_name': last_name or '',
    })
    if created:
        user.set_unusable_password()
        user.save()
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def check_email(request):
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=400)
    exists = User.objects.filter(email=email).exists()
    return Response({'exists': exists})

@api_view(['GET', 'PATCH'])
def user_me(request):
    if not request.user or not request.user.is_authenticated:
        return Response({'detail': 'Authentication required.'}, status=401)
    if request.method == 'PATCH':
        # Analytics consent revocation
        if 'consent_analytics_at' in request.data:
            # Just return current data for now
            pass
    return Response({
        'email': request.user.email,
        'first_name': request.user.first_name,
        'last_name': request.user.last_name,
        'consent_terms_at': getattr(request.user, 'consent_terms_at', None),
        'consent_analytics_at': getattr(request.user, 'consent_analytics_at', None),
    })
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_mix_shares(request):
    """Auth-only list of the user's Asset Mixes (token, name, total, asOf).

    ?q= filters by mix name; ?limit=N (default 10) caps results. Ordered by
    created_at descending so the latest mixes appear first.
    """
    limit = int(request.query_params.get('limit', 10))
    shares = MixShare.objects.filter(user=request.user).order_by('-created_at')
    q = (request.query_params.get('q') or '').strip().lower()
    if q:
        shares = [sh for sh in shares if q in (sh.snapshot or {}).get("name", "").lower()][:limit]
    else:
        shares = list(shares)[:limit]
    out = []
    for sh in shares:
        snap = sh.snapshot or {}
        out.append({
            "token": sh.token,
            "name": snap.get("name") or (sh.portfolio.name if sh.portfolio_id else "Asset Mix"),
            "totalValue": snap.get("totalValue", 0),
            "asOf": snap.get("asOf"),
            "itemCount": len(snap.get("items", [])),
            "created_at": sh.created_at.isoformat() if sh.created_at else None,
            "visibility": sh.visibility,
            "url": f"/asset-mix?token={sh.token}",
        })
    return Response(out)

@api_view(['GET'])
@permission_classes([AllowAny])
def list_public_mixes(request):
    """Public Asset Mix gallery — no login required. Only public mixes,
    latest 20 by default; ?q= filters by mix name (rest via search)."""
    qs = MixShare.objects.filter(visibility='public')
    q = (request.query_params.get('q') or '').strip().lower()
    out = []
    for sh in qs.order_by('-created_at')[:200]:
        snap = sh.snapshot or {}
        name = snap.get("name") or (sh.portfolio.name if sh.portfolio_id else "Asset Mix")
        if q and q not in name.lower():
            continue
        out.append({
            "token": sh.token,
            "name": name,
            "creator": snap.get("creator") or "NaijaFinance Hub user",
            "totalValue": snap.get("totalValue", 0),
            "asOf": snap.get("asOf"),
            "itemCount": len(snap.get("items", [])),
            "items": snap.get("items", [])[:10],
            "url": f"/asset-mix?token={sh.token}",
        })
        if not q and len(out) >= 20:
            break
    return Response(out[:20] if q else out)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_standalone_mix(request):
    """Create an Asset Mix directly (no portfolio required): pick assets by
    symbol/fund + a value each; snapshot is frozen + sanitized (allocation
    only). visibility defaults to public. Returns the public token/link."""
    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'detail': 'Mix name is required.'}, status=400)
    raw_items = request.data.get('items')
    if not isinstance(raw_items, list) or not raw_items:
        return Response({'detail': 'Add at least one asset (symbol or fund) to the mix.'}, status=400)
    vis = (request.data.get('visibility') or 'public').strip().lower()
    if vis not in ('public', 'private'):
        vis = 'public'
    rows = []
    total = Decimal('0.00')
    for it in raw_items[:20]:
        value = Decimal(str(it.get('value') or '0'))
        if value <= 0:
            continue
        fund_id = it.get('fund_id')
        symbol = (it.get('symbol') or '').strip().upper()
        if fund_id:
            fund = Fund.objects.filter(pk=fund_id).first()
            if not fund:
                continue
            rows.append({"symbol": fund.name, "class": f"Fund · {fund.get_asset_class_display()}", "value": float(value)})
        elif symbol:
            inst = Instrument.objects.filter(symbol__iexact=symbol, is_active=True).first()
            if not inst:
                continue
            rows.append({"symbol": inst.symbol, "class": inst.get_asset_class_display(), "value": float(value)})
        else:
            continue
        total += value
    if not rows:
        return Response({'detail': 'No valid assets in the mix — check symbols and values.'}, status=400)
    pct = [round(float(r["value"]) / float(total) * 100, 2) for r in rows]
    for r, p in zip(rows, pct):
        r["pct"] = p
    token = secrets.token_hex(6)
    share = MixShare.objects.create(
        token=token,
        user=request.user,
        portfolio=None,
        visibility=vis,
        snapshot={
            "name": name,
            "asOf": timezone.localdate().isoformat(),
            "totalValue": float(total),
            "items": rows,
            "creator": (request.user.first_name or "NaijaFinance Hub user").strip(),
        },
    )
    return Response({"token": token, "url": f"/asset-mix?token={token}", "visibility": vis}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_mix_visibility(request, token):
    """Owner-only: flip an Asset Mix between public and private.

    Public = viewable by anyone (no account needed). Private = owner-only
    (everyone else gets 404), per CEO product decision 19:11.
    """
    share = get_object_or_404(MixShare, token=token, user=request.user)
    vis = (request.data.get('visibility') or '').strip().lower()
    if vis not in ('public', 'private'):
        return Response({'detail': "visibility must be 'public' or 'private'."}, status=400)
    share.visibility = vis
    share.save(update_fields=['visibility', 'updated_at'])
    return Response({'token': share.token, 'visibility': share.visibility})

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def revoke_mix(request, token):
    """Owner-only revoke: deletes a public Asset Mix share (CCO privacy control).

    After revoke the share link stops resolving (404) — deliberate, immediate.
    """
    share = get_object_or_404(MixShare, token=token, user=request.user)
    share.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def build_portfolio_value_series(portfolio, period_days=90, with_meta=False):
    """Daily total-value series for one portfolio over the period.

    Instruments are valued with PriceHistory close prices; funds with
    NavSnapshot NAVs. Returns [{date, value}] oldest-first.

    S6: each item contributes only from its OWN inception — max(asset/fund
    inception date, period start) — never forward-filled across a
    portfolio-wide window before the asset existed. The Fund model has no
    inception_date field yet, so a fund's earliest NavSnapshot date stands
    in; every fund resolved via that fallback is reported through the
    items_missing_inception list (see portfolio_performance).

    with_meta=True returns (points, items_missing_inception).
    """
    today = timezone.localdate()
    start = today - timedelta(days=period_days)
    items = list(portfolio.items.all())
    if not items:
        return ([], []) if with_meta else []

    # quantities per instrument / fund
    inst_qty = defaultdict(lambda: Decimal('0.00'))
    fund_qty = defaultdict(lambda: Decimal('0.00'))
    for it in items:
        if it.instrument_id:
            inst_qty[it.instrument_id] += it.quantity
        elif it.fund_id:
            fund_qty[it.fund_id] += it.quantity

    price_series = {}  # inst_id -> {date: price}
    nav_series = {}    # fund_id -> {date: nav}

    if inst_qty:
        rows = list(
            PriceHistory.objects
            .filter(instrument_id__in=list(inst_qty.keys()), date__gte=start, date__lte=today)
            .order_by('date')
            .values('instrument_id', 'date', 'close_price')
        )
        for r in rows:
            price_series.setdefault(r['instrument_id'], {})[r['date']] = float(r['close_price'] or 0)
    if fund_qty:
        rows = list(
            NavSnapshot.objects
            .filter(fund_id__in=list(fund_qty.keys()), date__gte=start, date__lte=today)
            .order_by('date')
            .values('fund_id', 'date', 'nav')
        )
        for r in rows:
            nav_series.setdefault(r['fund_id'], {})[r['date']] = float(r['nav'] or 0)

    # S6: per-asset inception dates (batched).
    inst_inception = {}
    if inst_qty:
        rows = (
            Instrument.objects.filter(id__in=list(inst_qty.keys()))
            .annotate(first_date=Min('price_history__date'))
            .values_list('id', 'first_date')
        )
        inst_inception = {iid: d for iid, d in rows if d}
    fund_inception = {}
    missing_inception = []
    if fund_qty:
        rows = (
            Fund.objects.filter(id__in=list(fund_qty.keys()))
            .annotate(first_nav_date=Min('nav_snapshots__date'))
            .values_list('id', 'name', 'first_nav_date')
        )
        for fid, name, first_nav in rows:
            if first_nav:
                fund_inception[fid] = first_nav
                # No explicit inception_date field yet (S6): derived from data.
                missing_inception.append({"fund_id": fid, "fund": name})

    # Contribute only from own inception, clamped to the period start.
    inst_from = {iid: max(d, start) for iid, d in inst_inception.items()}
    fund_from = {fid: max(d, start) for fid, d in fund_inception.items()}

    all_dates = sorted({d for s in price_series.values() for d in s} | {d for s in nav_series.values() for d in s})
    if not all_dates:
        return ([], missing_inception) if with_meta else []

    last_price = {iid: None for iid in inst_qty}
    last_nav = {fid: None for fid in fund_qty}
    points = []
    for d in all_dates:
        for iid, s in price_series.items():
            if d < inst_from.get(iid, start):
                continue  # S6: no contribution or carry-forward before inception
            if d in s:
                last_price[iid] = s[d]
        for fid, s in nav_series.items():
            if d < fund_from.get(fid, start):
                continue  # S6: no contribution or carry-forward before inception
            if d in s:
                last_nav[fid] = s[d]
        value = Decimal('0.00')
        for iid, qty in inst_qty.items():
            p = last_price.get(iid)
            if p is not None:
                value += qty * Decimal(str(p))
        for fid, qty in fund_qty.items():
            n = last_nav.get(fid)
            if n is not None:
                value += qty * Decimal(str(n))
        points.append({"date": d.isoformat(), "value": round(float(value), 2)})
    return (points, missing_inception) if with_meta else points
