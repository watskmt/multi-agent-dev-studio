import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";
import { readAuditTail } from "../lib/audit-log";

export default defineTool({
  description: prompt`
    監査ログ memory/audit.jsonl の末尾を読み、ターン・サブエージェント・モデル・パイプライン状態の履歴を返す。
  `,
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(20),
  }),
  effect: "read",
  async execute({ limit }, ctx) {
    const records = await readAuditTail(ctx.stateRoot, limit);
    return { count: records.length, records };
  },
});