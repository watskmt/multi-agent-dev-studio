import itertools
import time

TTL_SECONDS = 15 * 60


class ReservationExpired(Exception):
    pass


class _Reservation:
    def __init__(self, rid, sku, qty, created):
        self.id = rid
        self.sku = sku
        self.qty = qty
        self.created = created
        self.status = "active"


class InventoryService:
    def __init__(self, stock, clock=time.monotonic):
        self._stock = dict(stock)
        self._clock = clock
        self._reservations = {}
        self._ids = itertools.count(1)
        self._audit = []

    def _release_expired(self):
        now = self._clock()
        for r in self._reservations.values():
            if r.status == "active" and now - r.created > TTL_SECONDS:
                r.status = "expired"
                self._stock[r.sku] += r.qty

    def available(self, sku):
        self._release_expired()
        return self._stock.get(sku, 0)

    def reserve(self, sku, qty):
        if sku not in self._stock:
            raise KeyError(sku)
        if qty <= 0:
            raise ValueError("qty must be positive")
        self._release_expired()
        current = self._stock[sku]
        if current < qty:
            raise ValueError("out of stock")
        rid = f"R{next(self._ids)}"
        self._audit.append(("reserve", rid, sku, qty, self._clock()))
        self._stock[sku] = current - qty
        self._reservations[rid] = _Reservation(rid, sku, qty, self._clock())
        return rid

    def cancel(self, rid):
        r = self._reservations[rid]
        r.status = "cancelled"
        self._stock[r.sku] += r.qty
        return True

    def confirm(self, rid):
        self._release_expired()
        r = self._reservations[rid]
        if r.status == "expired":
            raise ReservationExpired(rid)
        r.status = "confirmed"
