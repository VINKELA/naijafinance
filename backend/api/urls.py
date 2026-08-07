from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import *
from . import views
router = DefaultRouter()
router.register(r'stocks', InstrumentViewSet, basename='stock')
router.register(r'instruments', InstrumentViewSet, basename='instrument')
router.register(r'portfolios', PortfolioViewSet, basename='portfolio')
router.register(r'portfolio-items', PortfolioItemViewSet, basename='portfolio-item')
router.register(r'watchlists', WatchlistViewSet, basename='watchlist')
# Free Data Layer (Sprint 1: F-04..F-08)
router.register(r'bonds', BondInstrumentViewSet, basename='bond')
router.register(r'commercial-papers', CommercialPaperViewSet, basename='commercial-paper')
router.register(r'auctions', AuctionCalendarViewSet, basename='auction')
router.register(r'funds', FundViewSet, basename='fund')
router.register(r'fx-rates', FxRateViewSet, basename='fx-rate')
router.register(r'companies', CompanyProfileViewSet, basename='company')
router.register(r'alerts', AlertViewSet, basename='alert')

# Analytics: fire-and-forget event collection (CGO instrumentation ask, go-live)
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json, os, time

@csrf_exempt
@require_POST
def analytics_collect(request):
    try:
        payload = json.loads(request.body or b'{}')
        event = payload.get('event', 'unknown')
        meta = payload.get('meta', {})
        line = json.dumps({"ts": time.time(), "event": event, "meta": meta})
        path = os.getenv('ANALYTICS_LOG', '/tmp/naijafinance-analytics.jsonl')
        with open(path, 'a') as f:
            f.write(line + "\n")
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

urlpatterns = [
    # Auth Endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('user/me/', views.UserMeView.as_view(), name='user_me'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
# Celery Scraping Endpoints
    path('scrape/trigger/', trigger_scrape, name='trigger_scrape'),
    path('scrape/status/<int:job_id>/', check_scrape_status, name='check_scrape_status'),    # API Routes
    # NEW: Dashboard Data Endpoints
    path('stocks/movers/', views.get_top_movers, name='get_movers'),
    path('stocks/trends/', views.get_market_trends, name='get_trends'),
    path('overview/', views.market_overview, name='market_overview'),
    path('news/', views.get_news, name='get_news'),
    path('portfolio-summary/', views.get_portfolio_summary, name='get_portfolio_summary'),
    path('portfolio-insights/', views.get_portfolio_insights, name='get_portfolio_insights'),
    path('portfolio-items/add-by-symbol/', views.add_portfolio_item_by_symbol, name='add_portfolio_item_by_symbol'),
    path('watchlist/default/', views.default_watchlist, name='default_watchlist'),
    path('watchlist/history/', views.watchlist_history, name='watchlist_history'),
    path('compare/', views.compare_assets, name='compare_assets'),
    path('embed/', views.asset_embed, name='asset_embed'),
    path('embed/og/<str:ref>.png', views.embed_og_image, name='embed_og_image'),
    path('watchlist/toggle/', views.toggle_watchlist, name='toggle_watchlist'),
    path('portfolios/<int:pk>/performance/', views.portfolio_performance, name='portfolio_performance'),
    path('mix/', views.create_mix_share, name='create_mix_share'),
    path('mix/list/', views.list_mix_shares, name='list_mix_shares'),
    path('mix/public/', views.list_public_mixes, name='list_public_mixes'),
    path('mix/create/', views.create_standalone_mix, name='create_standalone_mix'),
    path('mix/<str:token>/visibility/', views.set_mix_visibility, name='set_mix_visibility'),
    path('mix/<str:token>/', views.mix_card, name='mix_card'),
    path('mix/<str:token>/revoke/', views.revoke_mix, name='revoke_mix'),
    path('mix/<str:token>/performance/', views.mix_performance, name='mix_performance'),
    path('earnings/', views.get_earnings, name='get_earnings'),
    # Add this to your urlpatterns:
    path('stock/<str:symbol>/', views.get_stock_detail, name='get_stock_detail'),
    path('fund/<int:pk>/', views.get_fund_detail, name='get_fund_detail'),
    path('company/<str:symbol>/', views.get_company_detail, name='get_company_detail'),
    path('stocks/search/', views.search_stocks, name='search_stocks'),
    path('indexes/', MarketIndexListView.as_view(), name='index-list'),
    path('indexes/<str:symbol>/', MarketIndexDetailView.as_view(), name='index-detail'),
    path('', include(router.urls)),
    path('posts/', views.list_posts, name='list_posts'),
    path('posts/create/', views.create_post, name='create_post'),
    path('posts/<int:pk>/', views.post_detail, name='post_detail'),
    path('analytics/', analytics_collect, name='analytics_collect'),


]

