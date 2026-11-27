import sys, threading
sys.path.insert(0, '.')
r = []
def check(name, fn):
    try:
        r.append((name, bool(fn())))
    except Exception:
        r.append((name, False))

def basic():
    from inventory import InventoryService
    s = InventoryService({'A': 3})
    rid = s.reserve('A', 2)
    return s.available('A') == 1 and isinstance(rid, str)

def qty_type():
    from inventory import InventoryService
    s = InventoryService({'A': 5})
    for bad in (True, 1.5, 0, -1):
        try:
            s.reserve('A', bad)
            return False
        except (ValueError, TypeError):
            pass
    return s.available('A') == 5

def race():
    from inventory import InventoryService
    old = sys.getswitchinterval()
    sys.setswitchinterval(1e-6)
    try:
        for _ in range(600):
            s = InventoryService({'A': 10})
            ok = []
            bar = threading.Barrier(40)
            def w():
                bar.wait()
                try:
                    s.reserve('A', 1); ok.append(1)
                except Exception:
                    pass
            ts = [threading.Thread(target=w) for _ in range(40)]
            [t.start() for t in ts]; [t.join() for t in ts]
            if len(ok) != 10 or s.available('A') != 0:
                return False
        return True
    finally:
        sys.setswitchinterval(old)

def cancel_idem():
    from inventory import InventoryService
    s = InventoryService({'A': 5})
    rid = s.reserve('A', 2)
    first = s.cancel(rid)
    second = s.cancel(rid)
    return first is True and second is False and s.available('A') == 5

def ttl_boundary():
    from inventory import InventoryService, ReservationExpired
    t = [1000.0]
    s = InventoryService({'A': 5}, clock=lambda: t[0])
    rid = s.reserve('A', 2)
    t[0] += 15 * 60  # exactly 15 minutes
    if s.available('A') != 5:
        return False
    try:
        s.confirm(rid)
        return False
    except ReservationExpired:
        return True

def discount_floor():
    from pricing import total
    return total([(333, 1)], 10) == 299 and total([(105, 1)], 50) == 52 and total([(100, 3)], 0) == 300

def discount_range():
    from pricing import total
    for bad in (101, -5, 10.5, True):
        try:
            total([(100, 1)], bad)
            return False
        except (ValueError, TypeError):
            pass
    return True

def note_xss():
    from render import render_order
    out = render_order('<b>n</b>', '<script>x</script>')
    return '<script>' not in out and '<b>' not in out

for name, fn in [('basic', basic), ('qty_type', qty_type), ('race', race), ('cancel_idem', cancel_idem),
                 ('ttl_boundary', ttl_boundary), ('discount_floor', discount_floor),
                 ('discount_range', discount_range), ('note_xss', note_xss)]:
    check(name, fn)
print('HIDDEN ' + ' '.join(k + '=' + ('PASS' if v else 'FAIL') for k, v in r))
