# multi-agent-dev-studio

複数の AI エージェントでアプリ開発する **Agent SDK** プロジェクトです。

- **オーケストレーター** — フェーズ管理とハンドオフ
- **spec-architect** — 仕様（Claude Sonnet + 高推論）
- **implementer** — 実装（Composer 2.5 Fast）
- **reviewer** — レビュー・テスト観点（Gemini Carbon Low。Qwen 等へ差し替え可）

## ローカル実行

```bash
cd /home/ubuntu/multi-agent-dev-studio
npx --yes "@grok/agent-sdk@0.7.3" validate --dir .
npm run check
npx --yes "@grok/agent-sdk@0.7.3" serve --dir . --mode single --dev
```

ブラウザで Playground（通常 `http://127.0.0.1:3000/playground`）を開き、例:

> 在庫管理の最小 Web アプリを作りたい。仕様からレビューまで回してください。

Cursor へサインイン（`npx --yes "@grok/agent-sdk@0.7.3" login` または `CURSOR_API_KEY`）後:

```bash
npx --yes "@grok/agent-sdk@0.7.3" run --dir . --message "在庫管理ミニアプリを仕様からレビューまで"
npx --yes "@grok/agent-sdk@0.7.3" eval --dir .
```

## モデルの変更

`bot/lib/models.ts` と各 `bot/subagents/*/agent.ts` の `model.id` を編集します。レビュー担当を Qwen など無料寄りのモデルにする場合は `reviewer` の id をアカウントで利用可能なスラッグに変更してください。

## レイアウト

| パス | 役割 |
| --- | --- |
| `bot/instructions.md` | オーケストレーター指示 |
| `bot/subagents/*` | 仕様 / 実装 / レビュー |
| `bot/tools/pipeline_*.ts` | 共有パイプライン状態（KV） |
| `bot/skills/dev-pipeline` | 標準ループ手順 |
