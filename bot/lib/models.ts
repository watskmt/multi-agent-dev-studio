/**
 * 軽量モデル ID のみ使う（同一モデルを全エージェントで共有）。
 * DEV_STUDIO_MODEL で上書き。Playground のモデル一覧と同じスラッグを指定する。
 *
 * アカウントで利用可能な軽量候補の例:
 * - gemini-2.5-flash（デフォルト）
 * - gpt-5.4-nano / gpt-5-mini
 * - deepseek-v41-flash-1017 / glm-5p3-flash
 * - claude-haiku-5-5
 * - default（Cursor の既定モデル）
 */
export const LIGHT_MODEL_ALTERNATIVES = [
  "gemini-2.5-flash",
  "gpt-5.4-nano",
  "gpt-5-mini",
  "deepseek-v41-flash-1017",
  "glm-5p3-flash",
  "claude-haiku-5-5",
  "default",
] as const;

const DEFAULT_SHARED_MODEL = "gemini-2.5-flash";

/** ルートエージェントとサブエージェント（継承）で共有するモデル ID */
export function resolveSharedModelId(): string {
  const fromEnv = process.env.DEV_STUDIO_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_SHARED_MODEL;
}

export const MODEL_POLICY = {
  mode: "shared-light" as const,
  sharedModelId: resolveSharedModelId(),
  rationale:
    "仕様・実装・レビューは役割別プロンプトで分離し、軽量モデル1種類でリクエストを節約する",
} as const;