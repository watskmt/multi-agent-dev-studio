# 在庫予約サービス 仕様

EC サイトの在庫予約モジュール。Web サーバーのワーカースレッドから同時に呼ばれる。

## inventory.InventoryService

- `InventoryService(stock: dict[str, int], clock=time.monotonic)` — 初期在庫と時計（秒を返す関数）を受け取る。
- `reserve(sku, qty) -> str` — 在庫を確保し、予約 ID を返す。
  - 数量は正の整数とする。真偽値や小数は数量として扱わず、`ValueError` か `TypeError` にする。
  - 複数のスレッドから同時に呼ばれても、在庫を超えて予約されてはならない。在庫が足りなければ `ValueError`。
  - 存在しない SKU は `KeyError`。
- `cancel(reservation_id) -> bool` — 予約を取り消して在庫を戻す。
  - 利用者のダブルクリックやリトライで何度も呼ばれる前提とする。在庫を戻すのは最初の 1 回だけで、そのとき `True`。2 回目以降や、既に失効・確定した予約では何もせず `False`。
- `confirm(reservation_id)` — 予約を確定する。失効した予約は `ReservationExpired`。
- `available(sku) -> int` — 現在の在庫数。
- 予約は作成から 15 分で失効する（15 分ちょうどで失効扱い）。失効した予約の在庫は、次にサービスへアクセスしたときに戻す。

## pricing.total(lines, discount_percent=0) -> int

- `lines` は `(単価円, 数量)` のリスト。小計に割引率（%）を適用した金額を返す。
- 割引率は 0〜100 の整数。範囲外や整数でない値は `ValueError`。
- 割引後の 1 円未満は切り捨てる。

## render.render_order(name, note) -> str

- 注文確認の HTML 断片 `<div><h2>{name}</h2><p>{note}</p></div>` を返す。
- 名前・備考はどちらも利用者の入力なので、HTML として解釈されないようにする。

## 受け入れ基準
- AC1: 在庫 3 の SKU を 2 個予約すると、`available` は 1 になる。
- AC2: `total([(100, 3)])` は 300。
- AC3: `render_order("太郎", "よろしく")` に「太郎」と「よろしく」が含まれる。
