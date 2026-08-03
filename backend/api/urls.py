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
router.register(r'auctions', AuctionCalendarViewSet, basename='auction')
router.register(r'funds', FundViewSet, basename='fund')
router.register(r'fx-rates', FxRateViewSet, basename='fx-rate')
router.register(r'companies', CompanyProfileViewSet, basename='company')
router.register(r'alerts', AlertViewSet, basename='alert')

urlpatterns = [
    # Auth Endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
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
    path('watchlist/toggle/', views.toggle_watchlist, name='toggle_watchlist'),
    path('earnings/', views.get_earnings, name='get_earnings'),
    # Add this to your urlpatterns:
    path('stock/<str:symbol>/', views.get_stock_detail, name='get_stock_detail'),
    path('stocks/search/', views.search_stocks, name='search_stocks'),
    path('indexes/', MarketIndexListView.as_view(), name='index-list'),
    path('indexes/<str:symbol>/', MarketIndexDetailView.as_view(), name='index-detail'),
    path('', include(router.urls)),

]
