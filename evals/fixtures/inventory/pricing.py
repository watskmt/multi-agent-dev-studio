def total(lines, discount_percent=0):
    """lines: list of (unit_price_yen, qty)"""
    subtotal = sum(price * qty for price, qty in lines)
    return round(subtotal * (100 - discount_percent) / 100)
