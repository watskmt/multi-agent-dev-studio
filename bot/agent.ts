import { defineAgent } from "@grok/agent-sdk";
import { resolveRoleModel } from "./lib/models";

export default defineAgent({
  model: resolveRoleModel("orchestrator"),
  name: "multi-agent-dev-studio",
  description:
    "複数の専門エージェントで仕様・実装・レビューを回すアプリ開発オーケストレーター（役割別モデル）",
  local: {
    sandbox: false,
  },
  concurrency: { maxRunningTurns: 1 },
});