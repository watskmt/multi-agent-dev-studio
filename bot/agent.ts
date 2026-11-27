import { defineAgent } from "@grok/agent-sdk";
import { MODEL_POLICY } from "./lib/models";

export default defineAgent({
  model: {
    id: MODEL_POLICY.orchestrator.id,
  },
  name: "multi-agent-dev-studio",
  description:
    "複数の専門エージェントで仕様・実装・レビューを回すアプリ開発オーケストレーター",
  local: {
    sandbox: true,
  },
});