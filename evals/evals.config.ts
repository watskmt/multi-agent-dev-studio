import { defineEvalConfig } from "@grok/agent-sdk/evals";
import { modelIdForLog, resolveRoleModel } from "../bot/lib/models";

export default defineEvalConfig({
  maxConcurrency: 1,
  judge: { model: modelIdForLog(resolveRoleModel("orchestrator")) },
});