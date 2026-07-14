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
        ('DERIVATIVE', 'Derivative (Options/Futures)')
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
    quantity = models.DecimalField(max_digits=20, decimal_places=6)
    purchase_price = models.DecimalField(max_digits=20, decimal_places=6)

class Watchlist(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, default="My Watchlist")
    instruments = models.ManyToManyField(Instrument, blank=True) # Used to be Stock


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
