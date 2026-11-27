/**
 * Model assignments per role. Swap ids in subagent agent.ts if your Cursor
 * account exposes different slugs (e.g. Qwen for lightweight review).
 */
export const MODEL_POLICY = {
  orchestrator: {
    id: "composer-2.5",
    rationale: "ルーティングとハンドオフの調整に高速なコーディングモデル",
  },
  specArchitect: {
    id: "claude-sonnet-5-5",
    params: [{ id: "reasoning_effort", value: "high" }],
    rationale: "要件・API・受け入れ基準の整理",
  },
  implementer: {
    id: "composer-2.5-fast",
    rationale: "実装とリファクタ",
  },
  reviewer: {
    // コスト重視のレビュー・テスト設計。Cursor で Qwen が使える場合は
    // 例: id: "qwen-..." に差し替え可能。
    id: "gemini-4-carbon-low",
    rationale: "チェックリスト化されたレビューとテスト観点の列挙",
  },
} as const;