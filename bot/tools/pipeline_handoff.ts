import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";
import {
  PIPELINE_KV_KEY,
  activeSubagentKey,
  applyHandoff,
  checkHandoff,
  checkNotInSubagent,
  type ActiveSubagent,
  type PipelineState,
} from "../lib/pipeline";

const phaseSchema = z.enum(["intake", "spec", "implement", "review", "done"]);

export default defineTool({
  description: prompt`
    フェーズ間ハンドオフを記録し、phase を更新する（オーケストレーター専用）。
    サブエージェント完了後に呼び、次の担当へ渡す文脈を残す。
    遷移は intake→spec→implement→review→(implement|spec|done)。implement の後は必ず review。
    review から移る前に pipeline_update の reviewVerdict で判定を記録すること。
    done は最後のレビューが approve / approve_with_nits のときだけ可能。
  `,
  inputSchema: z.object({
    toPhase: phaseSchema.optional().describe("移行先フェーズ"),
    phase: phaseSchema.optional().describe("toPhase の別名（後方互換）"),
    summary: z.string().min(1).describe("次の担当者向けの要約（日本語）"),
    fromPhase: phaseSchema.optional().describe("記録用。実際の遷移元は現在の phase"),
  }),
  effect: "write",
  async execute({ toPhase, phase, summary }, ctx) {
    const to = toPhase ?? phase;
    if (to === undefined) {
      return { ok: false, error: "toPhase を指定してください。" };
    }
    const active = (await ctx.host.kv.get(activeSubagentKey(ctx.session.id))) as
      | ActiveSubagent
      | undefined;
    const sub = checkNotInSubagent(active);
    if (!sub.ok) return sub;

    const raw = await ctx.host.kv.get(PIPELINE_KV_KEY);
    if (raw === undefined) {
      return {
        ok: false,
        error: "パイプライン未初期化。先に pipeline_update を実行してください。",
      };
    }
    const state = raw as PipelineState;
    const guard = checkHandoff(state, to);
    if (!guard.ok) return { ...guard, phase: state.phase };

    const { state: next, record } = applyHandoff(
      state,
      to,
      summary,
      new Date().toISOString(),
    );
    await ctx.host.kv.put(PIPELINE_KV_KEY, next);
    return { ok: true, handoff: record, state: next };
  },
});
