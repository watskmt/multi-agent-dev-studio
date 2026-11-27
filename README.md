# multi-agent-dev-studio

複数の AI エージェントでアプリ開発する **Agent SDK** プロジェクトです（**tobetsu-garbage-bot とは無関係の単独プロジェクト**）。

- **オーケストレーター** — フェーズ管理とハンドオフ
- **spec-architect** / **implementer** / **reviewer** — 役割別プロンプト **＋ 役割別モデル**

### 役割別モデル（デフォルト）

| 役割 | モデル | 環境変数 |
| --- | --- | --- |
| オーケストレーター | `gemini-2.5-flash` | `DEV_STUDIO_MODEL_ORCHESTRATOR` |
| 仕様 | `claude-sonnet-5-5`（high） | `DEV_STUDIO_MODEL_SPEC` |
| 実装 | `composer-2.5` | `DEV_STUDIO_MODEL_IMPLEMENT` |
| レビュー | `claude-haiku-5-5` | `DEV_STUDIO_MODEL_REVIEW` |

起動前に `export` するか `.env` を読み込んで上書き。Playground の `models_show` ツールで反映後の一覧を確認できる。

## R7600 など自宅 PC でのセットアップ

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
npx --yes "@grok/agent-sdk@0.7.3" login    # 初回のみ（R7600 では済みなら不要）
npx --yes "@grok/agent-sdk@0.7.3" serve --dir . --mode single --dev
```

Playground: `http://127.0.0.1:3000/playground`

### 3. 動作確認

```bash
npx --yes "@grok/agent-sdk@0.7.3" validate --dir .
npm run check
```

## モデルの変更

1. 環境変数（`.env.example` 参照）
2. または `bot/lib/models.ts` の `DEFAULT_ROLE_MODELS`

いずれも **Available models** に載っているスラッグのみ有効。

## 監査ログ

| ファイル | 内容 |
| --- | --- |
| `memory/journal.jsonl` | ターン概要（SDK 標準メモリ） |
| `memory/audit.jsonl` | モデル・サブエージェント・pipeline ツールの監査行（`audit` hook） |

Playground からは `audit_tail` ツールで直近の監査行を取得できる。

## レイアウト

| パス | 役割 |
| --- | --- |
| `bot/instructions.md` | オーケストレーター指示 |
| `bot/subagents/*` | 仕様 / 実装 / レビュー |
| `bot/tools/pipeline_*.ts` | 共有パイプライン状態 |