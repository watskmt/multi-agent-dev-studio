# multi-agent-dev-studio

複数の AI エージェントでアプリ開発する **Agent SDK** プロジェクトです

- **オーケストレーター** — フェーズ管理とハンドオフ
- **spec-architect** / **implementer** / **reviewer** — 役割別プロンプト（**モデルは親と同一の無料枠**を継承）

### 追加課金を避ける設定

- デフォルトモデル: `grok-3-mini`（Cursor 無料プランの枠内想定）
- サブエージェントは `model` 未指定で親を継承
- `concurrency.maxRunningTurns: 1`
- 環境変数 `DEV_STUDIO_MODEL` で無料枠モデルを指定（例: `gpt-4o-mini`）

## ローカルでのセットアップ

### 1. 専用リポジトリを用意（推奨）

[GitHub](https://github.com/new) で **空の** リポジトリ `multi-agent-dev-studio` を作成（README や .gitignore は追加しない）。

このプロジェクトを手元に取り込む方法はどちらか一方です。

**A. Cloud Agent から tarball を取得した場合**（パスは手元の場所に合わせる）

```bash
mkdir -p ~/multi-agent-dev-studio
cd ~/multi-agent-dev-studio
tar xzf ~/Downloads/multi-agent-dev-studio.tar.gz   # 例
npm install
```

**B. GitHub リポジトリ（空）に載せる**

リポジトリ: **https://github.com/watskmt/multi-agent-dev-studio**

```bash
git clone https://github.com/watskmt/multi-agent-dev-studio.git ~/multi-agent-dev-studio
cd ~/multi-agent-dev-studio
# ここにプロジェクト一式をコピー（tar 展開など）してから:
npm install
git add -A
git commit -m "Initial import"
git push origin main
```

**C. git bundle から復元**（チャットの成果物 `multi-agent-dev-studio.bundle` を入手した場合）

```bash
git clone multi-agent-dev-studio.bundle multi-agent-dev-studio
cd multi-agent-dev-studio
git remote add origin https://github.com/watskmt/multi-agent-dev-studio.git
git push -u origin main
```

### 2. 起動（必ずこのフォルダで）

ホームディレクトリで `serve` すると `No agent found` になります。**`bot/` がある直下**で実行してください。

```bash
cd ~/multi-agent-dev-studio
npm install
npx --yes "@grok/agent-sdk@0.7.3" login    # 初回のみ
npx --yes "@grok/agent-sdk@0.7.3" serve --dir . --mode single --dev
```

Playground: `http://127.0.0.1:3000/playground`

### 3. 動作確認

```bash
npx --yes "@grok/agent-sdk@0.7.3" validate --dir .
npm run check
```

## モデルの変更

`DEV_STUDIO_MODEL` または `bot/lib/models.ts` の `DEFAULT_FREE_MODEL` を、Cursor 設定で有効な**無料枠**スラッグに合わせる。

## レイアウト

| パス | 役割 |
| --- | --- |
| `bot/instructions.md` | オーケストレーター指示 |
| `bot/subagents/*` | 仕様 / 実装 / レビュー |
| `bot/tools/pipeline_*.ts` | 共有パイプライン状態 |
