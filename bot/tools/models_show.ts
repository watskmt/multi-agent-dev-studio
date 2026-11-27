import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { MODEL_POLICY, modelIdForLog, resolveRoleModel, type DevRole } from "../lib/models";

const ROLES: DevRole[] = [
  "orchestrator",
  "spec-architect",
  "implementer",
  "reviewer",
];

export default defineTool({
  description: prompt`
    役割ごとに設定されているモデル id を返す（環境変数で上書き済みの値を反映）。
  `,
  inputSchema: z.object({}),
  effect: "read",
  async execute() {
    const byRole = Object.fromEntries(
      ROLES.map((role) => [role, modelIdForLog(resolveRoleModel(role))]),
    );
    return {
      policy: MODEL_POLICY.mode,
      byRole,
      envKeys: {
        orchestrator: "DEV_STUDIO_MODEL_ORCHESTRATOR",
        "spec-architect": "DEV_STUDIO_MODEL_SPEC",
        implementer: "DEV_STUDIO_MODEL_IMPLEMENT",
        reviewer: "DEV_STUDIO_MODEL_REVIEW",
      },
    };
  },
});