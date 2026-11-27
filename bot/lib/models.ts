import type { ModelSetting } from "@grok/agent-sdk";

/** サブエージェント id と同じキー */
export type DevRole = "orchestrator" | "spec-architect" | "implementer" | "reviewer";

export type RoleModelSelection = ModelSetting;

const ROLE_ENV: Record<DevRole, string> = {
  orchestrator: "DEV_STUDIO_MODEL_ORCHESTRATOR",
  "spec-architect": "DEV_STUDIO_MODEL_SPEC",
  implementer: "DEV_STUDIO_MODEL_IMPLEMENT",
  reviewer: "DEV_STUDIO_MODEL_REVIEW",
};

/**
 * 役割ごとのデフォルト。利用可能一覧に無い ID は環境変数で差し替える。
 * Playground の Available models と照合すること。
 */
const DEFAULT_ROLE_MODELS: Record<DevRole, RoleModelSelection> = {
  orchestrator: "gemini-2.5-flash",
  "spec-architect": {
    id: "claude-sonnet-5-5",
    params: [{ id: "reasoning_effort", value: "high" }],
  },
  implementer: "composer-2.5",
  reviewer: "claude-haiku-5-5",
};

function envOverride(role: DevRole): string | undefined {
  const key = ROLE_ENV[role];
  const value = process.env[key]?.trim();
  if (value) return value;
  // 後方互換: ルートのみ DEV_STUDIO_MODEL
  if (role === "orchestrator") {
    return process.env.DEV_STUDIO_MODEL?.trim() || undefined;
  }
  return undefined;
}

/** defineAgent の model に渡す */
export function resolveRoleModel(role: DevRole): RoleModelSelection {
  const fromEnv = envOverride(role);
  if (fromEnv) return fromEnv;
  return DEFAULT_ROLE_MODELS[role];
}

/** 監査ログ・一覧表示用の平坦なモデル id */
export function modelIdForLog(model: RoleModelSelection): string {
  return typeof model === "string" ? model : model.id;
}

export function isSubagentRole(name: string | undefined): name is Exclude<DevRole, "orchestrator"> {
  return (
    name === "spec-architect" ||
    name === "implementer" ||
    name === "reviewer"
  );
}

export function configuredModelForSubagent(name: string | undefined): string | undefined {
  if (!isSubagentRole(name)) return undefined;
  return modelIdForLog(resolveRoleModel(name));
}

export const MODEL_POLICY = {
  mode: "per-role" as const,
  roles: {
    orchestrator: modelIdForLog(resolveRoleModel("orchestrator")),
    specArchitect: modelIdForLog(resolveRoleModel("spec-architect")),
    implementer: modelIdForLog(resolveRoleModel("implementer")),
    reviewer: modelIdForLog(resolveRoleModel("reviewer")),
  },
} as const;