from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.conf import settings

# ==========================================
# 1. ABSTRACT BASE & AUTH
# ==========================================

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email: raise ValueError('The Email field must be set')
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    username = None 
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = [] 
    objects = CustomUserManager()

    # Compliance: consent tracking for MVP sign-off
    consent_terms_at = models.DateTimeField(null=True, blank=True, help_text="ISO timestamp when user accepted T&C + Privacy Policy")
    consent_analytics_at = models.DateTimeField(null=True, blank=True, help_text="ISO timestamp when user opted into anonymized usage analytics")
    is_premium = models.BooleanField(default=False, help_text="Premium subscription tier (Voice Learn + advanced features)")

    def __str__(self): return self.email


# ==========================================
# 2. GLOBAL GEOGRAPHY & CURRENCY
# ==========================================

class Region(TimeStampedModel):
    """Represents a Country or Economic Zone (e.g., USA, Nigeria, Eurozone)."""
    name = models.CharField(max_length=100, unique=True)
    iso_code = models.CharField(max_length=3, unique=True, help_text="e.g., USA, NGA, GBR")
    
    class Meta:
        ordering = ['name']
    def __str__(self): return self.name

class Currency(TimeStampedModel):
    """Tracks fiat and crypto currencies (e.g., USD, NGN, BTC)."""
    code = models.CharField(max_length=10, unique=True, help_text="e.g., USD, NGN, EUR")
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        verbose_name_plural = "Currencies"
    def __str__(self): return self.code


# ==========================================
# 3. MARKETS, EXCHANGES & ISSUERS
# ==========================================

class Market(TimeStampedModel):
    """The broad asset ecosystem (Equities, Fixed Income/Bonds, Forex, Commodities)."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self): return self.name

class Exchange(TimeStampedModel):
    """The physical/digital entity where trading occurs (TSX, NGX, NYSE, NYMEX)."""
    market = models.ForeignKey(Market, on_delete=models.CASCADE, related_name='exchanges')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, related_name='exchanges')
    
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True, help_text="e.g., TSX, NYSE")
    mic_code = models.CharField(max_length=10, blank=True, null=True, help_text="Market Identifier Code")
    timezone = models.CharField(max_length=50, default='UTC')

    def __str__(self): return f"{self.name} ({self.code})"

class Issuer(TimeStampedModel):
    """The entity issuing the asset (e.g., Apple Inc., Federal Government of Nigeria)."""
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=255, unique=True)
    industry_sector = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self): return self.name


# ==========================================
# 4. THE SECURITY MASTER (INSTRUMENTS)
# ==========================================

class Instrument(TimeStampedModel):
    """
    The Universal Asset Model. Replaces 'Stock'. 
    Can represent a Stock, Bond, Forex Pair, Commodity, or Derivative.
    """
    ASSET_CLASSES = [
        ('EQUITY', 'Equity (Stock)'),
        ('BOND', 'Fixed Income (Bond)'),
        ('FOREX', 'Foreign Exchange'),
        ('COMMODITY', 'Commodity'),
        ('CRYPTO', 'Cryptocurrency'),
        ('DERIVATIVE', 'Derivative (Options/Futures)'),
        ('COMMERCIAL_PAPER', 'Commercial Paper (CP)')
    ]

    # Core Identifiers
    asset_class = models.CharField(max_length=20, choices=ASSET_CLASSES)
    symbol = models.CharField(max_length=50, db_index=True) 
    name = models.CharField(max_length=255)
    
    # Relationships
    issuer = models.ForeignKey(Issuer, on_delete=models.SET_NULL, null=True, blank=True, help_text="Null for Forex/Crypto")
    exchange = models.ForeignKey(Exchange, on_delete=models.SET_NULL, null=True, blank=True, help_text="Null for OTC Markets")
    base_currency = models.ForeignKey(Currency, on_delete=models.RESTRICT, related_name='base_instruments')
    
    # Current Market Data
    last_price = models.DecimalField(max_digits=20, decimal_places=6, default=0.00)
    is_active = models.BooleanField(default=True)

    # ----------------------------------------------------
    # ASSET-SPECIFIC FIELDS (Nullable to handle all types)
    # ----------------------------------------------------
    
    # For Forex/Crypto Pairs (e.g., Base: BTC, Quote: USD)
    quote_currency = models.ForeignKey(Currency, on_delete=models.SET_NULL, null=True, blank=True, related_name='quote_instruments')
    
    # For Bonds (Fixed Income)
    maturity_date = models.DateField(null=True, blank=True)
    coupon_rate = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True, help_text="e.g., 0.0550 for 5.5%")
    
    # For Derivatives (Options/Futures)
    expiration_date = models.DateField(null=True, blank=True)
    strike_price = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)

    class Meta:
        unique_together = ('exchange', 'symbol') 
        indexes = [models.Index(fields=['asset_class', 'symbol'])]

    def __str__(self):
        return f"{self.symbol} ({self.get_asset_class_display()})"


# ==========================================
# 5. INDEXES & PRICE HISTORY
# ==========================================

class MarketIndex(TimeStampedModel):
    """Tracks a basket of instruments (e.g., S&P 500, NGX All-Share)."""
    exchange = models.ForeignKey(Exchange, on_delete=models.SET_NULL, null=True, blank=True, related_name='indexes')
    name = models.CharField(max_length=100) 
    symbol = models.CharField(max_length=50, unique=True) 
    current_price = models.DecimalField(max_digits=15, decimal_places=4, default=0.00)
    point_change = models.DecimalField(max_digits=15, decimal_places=4, default=0.00)
    percent_change = models.DecimalField(max_digits=8, decimal_places=4, default=0.00)
    
    # Links to the Universal Instrument model
    constituents = models.ManyToManyField(Instrument, through='IndexConstituent')

    def __str__(self): return self.symbol

class IndexConstituent(TimeStampedModel):
    market_index = models.ForeignKey(MarketIndex, on_delete=models.CASCADE)
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE)
    weight = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)

    class Meta:
        unique_together = ('market_index', 'instrument')

class PriceHistory(TimeStampedModel):
    """Universal OHLCV data for ANY instrument (Stock, Bond, Forex, etc)."""
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name='price_history')
    date = models.DateField(db_index=True) 
    open_price = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    high_price = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    low_price = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    close_price = models.DecimalField(max_digits=20, decimal_places=6) 
    volume = models.BigIntegerField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Price Histories"
        unique_together = ('instrument', 'date')
        ordering = ['-date']

# ==========================================
# 6. PORTFOLIOS & WATCHLISTS (Updated for Instruments)
# ==========================================

class Portfolio(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)

class PortfolioItem(TimeStampedModel):
    portfolio = models.ForeignKey(Portfolio, related_name='items', on_delete=models.CASCADE)
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, null=True, blank=True) # Used to be Stock
    fund = models.ForeignKey('Fund', on_delete=models.CASCADE, null=True, blank=True, related_name='portfolio_items')
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    purchase_price = models.DecimalField(max_digits=20, decimal_places=6)

class Watchlist(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, default="My Watchlist")
    instruments = models.ManyToManyField(Instrument, blank=True) # Used to be Stock
    funds = models.ManyToManyField('Fund', blank=True, related_name='watchlists')


class MixShare(TimeStampedModel):
    """Public, shareable 'Asset Mix' card.

    Privacy boundary (CEO 16:46): a mix is a deliberate, public snapshot that
    carries ONLY allocation-level data (symbol, class, value, pct) — never
    quantities, cost basis, P&L, or user identity. It is decoupled from the
    source portfolio: the card stays live as a frozen snapshot if the
    portfolio is deleted, and can be revoked by the owner at any time.
    """
    token = models.CharField(max_length=32, unique=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    portfolio = models.ForeignKey(Portfolio, related_name='mix_shares', on_delete=models.SET_NULL, null=True, blank=True)
    snapshot = models.JSONField(default=dict, blank=True)  # frozen card data
    visibility = models.CharField(
        max_length=10,
        choices=[('public', 'Public'), ('private', 'Private')],
        default='public',
        help_text="Public mixes are viewable by anyone (no account); private mixes are owner-only.",
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"MixShare {self.token} ({self.portfolio.name})"


# ==========================================
# 7. NEWS, EARNINGS & SCRAPE TRACKING
# ==========================================

class NewsArticle(models.Model):
    source = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    url = models.URLField(blank=True, null=True)
    published_at = models.DateTimeField()

    class Meta:
        ordering = ['-published_at']

    def __str__(self):
        return self.title


class EarningsCalendar(models.Model):
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE)
    report_date = models.DateTimeField()

    class Meta:
        ordering = ['report_date']

    def __str__(self):
        return f"{self.instrument.symbol} - {self.report_date:%Y-%m-%d}"


class ScrapeExecution(TimeStampedModel):
    STATUSES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    target_url = models.URLField()
    status = models.CharField(max_length=20, choices=STATUSES, default='PENDING')
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Scrape #{self.pk} - {self.status}"


class ScrapeTargetSymbol(models.Model):
    STATUSES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    execution = models.ForeignKey(ScrapeExecution, on_delete=models.CASCADE, related_name='symbols')
    symbol = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUSES, default='PENDING')
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['symbol']
        unique_together = ('execution', 'symbol')

    def __str__(self):
        return f"{self.symbol} ({self.status})"


# ==========================================
# 8. Free public data layer
# ==========================================
# All models in this section are populated from public/free sources only
# (DMO publications, CBN published FX rates, fund NAV publications, issuer
# filings). No login-based scraping. Display data only — not investment advice.


class AuctionCalendar(TimeStampedModel):
    """FGN bond / T-bill auction calendar & results (public DMO data)."""
    instrument = models.ForeignKey(
        Instrument, on_delete=models.CASCADE, related_name='auctions',
        limit_choices_to={'asset_class': 'BOND'},
    )
    auction_date = models.DateField(db_index=True)
    tenor = models.CharField(max_length=50, help_text="e.g., 91-day, 182-day, 364-day, 10-year")
    offer_size = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True,
        help_text="Offer size in NGN (billions as published by DMO).",
    )
    stop_rate = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True,
        help_text="Stop rate / marginal rate as published by DMO (percent).",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['auction_date']
        indexes = [models.Index(fields=['auction_date', 'is_active'])]

    def __str__(self):
        return f"{self.instrument.symbol} @ {self.auction_date}"


class Fund(TimeStampedModel):
    """A publicly offered mutual fund (Nigerian market)."""
    ASSET_CLASSES = [
        ('MONEY_MARKET', 'Money Market'),
        ('FIXED_INCOME', 'Fixed Income'),
        ('EQUITY', 'Equity'),
        ('BALANCED', 'Balanced'),
        ('ETHICAL', 'Ethical/Islamic'),
        ('REAL_ESTATE', 'Real Estate'),
        ('OTHER', 'Other'),
    ]
    name = models.CharField(max_length=255, unique=True)
    manager = models.CharField(max_length=255, blank=True, null=True)
    asset_class = models.CharField(max_length=20, choices=ASSET_CLASSES, default='OTHER')
    is_active = models.BooleanField(default=True)

    # S2 fund-info schema (frozen 15-field payload). All nullable until real
    # data is acquired from fund managers' published disclosures — null means
    # "not yet acquired", never a guessed value.
    registrar_trustee = models.CharField(max_length=255, blank=True, null=True)
    custodian = models.CharField(max_length=255, blank=True, null=True)
    update_cadence = models.CharField(max_length=50, blank=True, null=True)
    inception_date = models.DateField(null=True, blank=True)
    benchmark = models.CharField(max_length=255, blank=True, null=True)
    fee_breakdown = models.JSONField(blank=True, null=True)
    aum = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True, help_text="Assets under management in NGN")
    minimum_investment = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True, help_text="Minimum initial investment in NGN")
    fact_sheet_url = models.URLField(blank=True, null=True)
    sec_registration_status = models.CharField(max_length=100, blank=True, null=True)
    risk_profile = models.CharField(max_length=50, blank=True, null=True)
    currency = models.CharField(max_length=10, default='NGN', blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class NavSnapshot(TimeStampedModel):
    """Published Net Asset Value per share for a fund (public data)."""
    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='nav_snapshots')
    date = models.DateField(db_index=True)
    nav = models.DecimalField(max_digits=20, decimal_places=4)

    class Meta:
        ordering = ['-date']
        unique_together = ('fund', 'date')

    def __str__(self):
        return f"{self.fund.name} NAV {self.nav} @ {self.date}"


class DataIngestRun(models.Model):
    """One execution of a scheduled data-ingestion job (S1: daily SEC NAV).

    Minimal run log: status + timestamps + row count, so ops can see whether
    the scheduled pipeline is alive without touching container logs.
    """
    STATUSES = [
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('SKIPPED', 'Skipped'),
    ]
    source = models.CharField(max_length=50, default='SEC_NAV', db_index=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='RUNNING')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    rows_ingested = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.source} #{self.pk} {self.status} @ {self.started_at:%Y-%m-%d %H:%M}" 


class FxRate(TimeStampedModel):
    """Official published exchange rate (CBN window / public release)."""
    pair = models.CharField(max_length=20, db_index=True, help_text="e.g., USD/NGN, GBP/NGN, EUR/NGN")
    rate = models.DecimalField(max_digits=20, decimal_places=4)
    date = models.DateField(db_index=True)
    source = models.CharField(max_length=50, default='CBN')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['pair', '-date']
        unique_together = ('pair', 'date', 'source')

    def __str__(self):
        return f"{self.pair} {self.rate} ({self.source}, {self.date})"


class CompanyProfile(TimeStampedModel):
    """Public company profile + key fundamentals for display only."""
    symbol = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    # Fundamentals — nullable display fields, NOT investment advice.
    eps = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True, help_text="Earnings per share")
    pe_ratio = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True, help_text="Price/Earnings ratio")
    book_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True, help_text="Book value per share")
    market_cap = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True, help_text="Market capitalisation in NGN")
    # Display-only annual revenue series for the companies chart (demo data).
    revenue_history = models.JSONField(default=list, blank=True, null=True, help_text="[{year, revenue_ngn}, ...] display only")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['symbol']

    def __str__(self):
        return f"{self.symbol} ({self.name})"


class Alert(TimeStampedModel):
    """User-defined threshold alert (Sprint 1: evaluation flag only, no notifications)."""
    ALERT_TYPES = [
        ('PRICE', 'Price'),
        ('YIELD', 'Yield'),
        ('NAV', 'NAV'),
    ]
    DIRECTIONS = [
        ('ABOVE', 'Above threshold'),
        ('BELOW', 'Below threshold'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alerts')
    instrument = models.ForeignKey(
        Instrument, on_delete=models.CASCADE, null=True, blank=True, related_name='alerts'
    )
    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, null=True, blank=True, related_name='alerts')
    alert_type = models.CharField(max_length=10, choices=ALERT_TYPES)
    threshold = models.DecimalField(max_digits=20, decimal_places=6)
    direction = models.CharField(max_length=10, choices=DIRECTIONS, default='ABOVE')
    active = models.BooleanField(default=True)
    triggered = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(null=True, blank=True)
    last_evaluated_at = models.DateTimeField(null=True, blank=True)
    last_value = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.email} {self.get_alert_type_display()} {self.direction} {self.threshold}"


class Post(TimeStampedModel):
    """NaijaFinanceHub content (CEO 20:14) — 'the YouTube of finance in Nigeria'.
    Public marketing surface: write about an asset, embed a YouTube video
    (video_url -> oEmbed thumbnail/player) and link an asset's info page
    (asset_url -> inline commodity card preview). Read = public; write = signed-up users.
    """
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default='')
    video_url = models.URLField(blank=True, null=True)
    asset_url = models.CharField(max_length=300, blank=True, null=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='posts')
    is_published = models.BooleanField(default=True)
    ext_link = models.URLField(blank=True, null=True, help_text='External source URL (RSS imports)')
    is_rss = models.BooleanField(default=False, help_text='Auto-imported from RSS feed')
