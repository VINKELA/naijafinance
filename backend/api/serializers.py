from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Exchange, Instrument, Portfolio, PortfolioItem, 
    Watchlist, MarketIndex, PriceHistory
)
from .display import display_instrument_name

User = get_user_model()

# --- Auth Serializers ---
class UserSerializer(serializers.ModelSerializer):
    re_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('id', 'email', 'password', 're_password', 'first_name', 'last_name')
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, attrs):
        re_password = attrs.get('re_password')
        if re_password is not None and attrs.get('password') != re_password:
            raise serializers.ValidationError({'re_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('re_password', None)
        user = User.objects.create_user(**validated_data)
        return user

# --- Data Serializers ---
class ExchangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exchange
        fields = '__all__'

class InstrumentSerializer(serializers.ModelSerializer):
    exchange_code = serializers.CharField(source='exchange.code', read_only=True, default="OTC")
    exchange_name = serializers.CharField(source='exchange.name', read_only=True, default="OTC")
    asset_type = serializers.CharField(source='get_asset_class_display', read_only=True)
    sector = serializers.CharField(source='issuer.industry_sector', read_only=True, default="")
    name = serializers.SerializerMethodField()
    
    class Meta:
        model = Instrument
        # Replaced 'sector' with asset_type since Instrument handles bonds, forex, etc.
        fields = ['id', 'symbol', 'name', 'last_price', 'exchange_code', 'exchange_name', 'asset_type', 'sector']

    def get_name(self, obj):
        return display_instrument_name(obj)

# --- Portfolio Serializers ---
class PortfolioItemSerializer(serializers.ModelSerializer):
    symbol = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()
    current_value = serializers.SerializerMethodField()
    gain_loss = serializers.SerializerMethodField()
    gain_loss_pct = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioItem
        fields = [
            'id', 'instrument', 'symbol', 'name', 'quantity', 'purchase_price',
            'current_price', 'current_value', 'gain_loss', 'gain_loss_pct'
        ]

    def get_symbol(self, obj):
        return obj.instrument.symbol if obj.instrument else ""

    def get_name(self, obj):
        return display_instrument_name(obj.instrument) if obj.instrument else ""

    def get_current_price(self, obj):
        return obj.instrument.last_price if obj.instrument else 0

    def get_current_value(self, obj):
        if not obj.instrument:
            return 0
        return obj.quantity * obj.instrument.last_price

    def get_gain_loss(self, obj):
        if not obj.instrument:
            return 0
        return (obj.instrument.last_price - obj.purchase_price) * obj.quantity

    def get_gain_loss_pct(self, obj):
        if obj.purchase_price == 0 or not obj.instrument:
            return 0
        return ((obj.instrument.last_price - obj.purchase_price) / obj.purchase_price) * 100

class PortfolioSerializer(serializers.ModelSerializer):
    items = PortfolioItemSerializer(many=True, read_only=True)
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'items', 'total_value']

    def get_total_value(self, obj):
        # Calculates current value by multiplying quantity by the instrument's last_price
        return sum([(item.quantity * (item.instrument.last_price or 0)) for item in obj.items.all() if item.instrument])

# --- Watchlist Serializer ---
class WatchlistSerializer(serializers.ModelSerializer):
    instruments = InstrumentSerializer(many=True, read_only=True)
    
    # Write-only field to add instruments by ID
    instrument_ids = serializers.PrimaryKeyRelatedField(
        queryset=Instrument.objects.all(), source='instruments', many=True, write_only=True, required=False
    )

    class Meta:
        model = Watchlist
        fields = ['id', 'name', 'instruments', 'instrument_ids']

# --- Index Serializers ---
class MarketIndexSerializer(serializers.ModelSerializer):
    isUp = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    last_updated = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = MarketIndex
        # current_price, point_change, and percent_change are now native model fields!
        fields = ['id', 'name', 'symbol', 'current_price', 'point_change', 'percent_change', 'isUp', 'history', 'last_updated']

    def get_isUp(self, obj):
        return obj.point_change >= 0

    def get_history(self, obj):
        return []
