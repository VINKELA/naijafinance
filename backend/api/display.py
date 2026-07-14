SYNTHETIC_NAME_PREFIXES = ('CSCS:', 'Nigerian Exchange:')


def display_instrument_name(instrument):
    name = (getattr(instrument, 'name', '') or '').strip()
    symbol = (getattr(instrument, 'symbol', '') or '').strip()

    if not name:
        return symbol

    upper_name = name.upper()
    for prefix in SYNTHETIC_NAME_PREFIXES:
        if upper_name.startswith(prefix.upper()):
            suffix = name.split(':', 1)[1].strip() if ':' in name else symbol
            return f"Nigerian Exchange: {suffix or symbol}"

    return name


def instrument_about_text(instrument):
    display_name = display_instrument_name(instrument)
    exchange_name = instrument.exchange.name if instrument.exchange else 'Nigerian Exchange'
    asset_type = instrument.get_asset_class_display()
    return f"{display_name} ({instrument.symbol}) is an actively tracked {asset_type} listed on {exchange_name}."
