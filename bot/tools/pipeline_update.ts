import { defineTool } from "@grok/agent-sdk/tools";
import { prompt } from "@grok/agent-sdk";
import * as z from "zod/v4";
import {
  PIPELINE_KV_KEY,
  activeSubagentKey,
  checkCompleteMilestone,
  checkNotInSubagent,
  emptyPipeline,
  remainingMilestones,
  type ActiveSubagent,
  type PipelineState,
} from "../lib/pipeline";

const phaseSchema = z.enum(["intake", "spec", "implement", "review", "done"]);
const verdictSchema = z.enum(["approve", "approve_with_nits", "request_changes"]);

export default defineTool({
  description: prompt`
    開発パイプライン状態を作成または部分更新する（オーケストレーター専用）。
    新しいプロジェクトは reset: true と projectName / goal で初期化する。以降は spec 等をマージする。
    フェーズの変更は pipeline_handoff で行う（ここでは変更できない）。
    review フェーズではレビュー担当の判定を reviewVerdict に記録する。
    仕様フェーズの後に milestones（例: ["M1","M2"]）を登録し、implement に渡す前に currentMilestone を設定する。
    approve 系の判定を記録したら completeMilestone で完了を記録する。全マイルストーン完了まで done にできない。
  `,
  inputSchema: z.object({
    reset: z
      .boolean()
      .optional()
      .describe("true なら既存状態を破棄して新規作成（projectName と goal が必須）"),
    projectName: z.string().min(1).optional(),
    goal: z.string().min(1).optional(),
    stackNotes: z.string().optional(),
    phase: phaseSchema.optional().describe("非対応。pipeline_handoff を使う"),
    spec: z.string().optional(),
    implementationNotes: z.string().optional(),
    reviewReport: z.string().optional(),
    reviewVerdict: verdictSchema.optional().describe("review フェーズでのみ記録可能"),
    milestones: z.array(z.string().min(1)).optional().describe("マイルストーン ID の一覧"),
    currentMilestone: z.string().min(1).optional().describe("これから実装・レビューするマイルストーン"),
    completeMilestone: z.string().min(1).optional().describe("approve 後に完了を記録するマイルストーン"),
    openIssues: z.array(z.string()).optional(),
    appendOpenIssue: z.string().optional(),
    clearOpenIssues: z.boolean().optional(),
  }),
  effect: "write",
  async execute(input, ctx) {
    const active = (await ctx.host.kv.get(activeSubagentKey(ctx.session.id))) as
      | ActiveSubagent
      | undefined;
    const sub = checkNotInSubagent(active);
    if (!sub.ok) return sub;

    if (input.phase !== undefined) {
      return {
        ok: false,
        error: "phase は pipeline_update では変更できません。pipeline_handoff の toPhase を使ってください。",
      };
    }

    const existing = (await ctx.host.kv.get(PIPELINE_KV_KEY)) as PipelineState | undefined;
    let state: PipelineState;

    if (existing === undefined || input.reset) {
      if (!input.projectName || !input.goal) {
        return {
          ok: false,
          error: "初期化（初回または reset: true）には projectName と goal が必須です。",
        };
      }
      state = emptyPipeline(input.goal, input.projectName);
    } else {
      state = { ...existing };
    }

    if (input.reviewVerdict !== undefined) {
      if (state.phase !== "review") {
        return {
          ok: false,
          error: `reviewVerdict は review フェーズでのみ記録できます（現在: ${state.phase}）。`,
        };
      }
      state.lastReviewVerdict = input.reviewVerdict;
    }

    if (input.milestones) {
      state.milestones = input.milestones;
      state.completedMilestones = (state.completedMilestones ?? []).filter((m) =>
        input.milestones!.includes(m),
      );
    }
    if (input.currentMilestone !== undefined) {
      if (!(state.milestones ?? []).includes(input.currentMilestone)) {
        return { ok: false, error: `未登録のマイルストーンです: ${input.currentMilestone}。先に milestones を登録してください。` };
      }
      state.currentMilestone = input.currentMilestone;
    }
    if (input.completeMilestone !== undefined) {
      const g = checkCompleteMilestone(state, input.completeMilestone);
      if (!g.ok) return g;
      const done = new Set(state.completedMilestones ?? []);
      done.add(input.completeMilestone);
      state.completedMilestones = [...done];
    }

    if (input.projectName) state.projectName = input.projectName;
    if (input.goal) state.goal = input.goal;
    if (input.stackNotes) state.stackNotes = input.stackNotes;
    if (input.spec !== undefined) state.spec = input.spec;
    if (input.implementationNotes !== undefined) {
      state.implementationNotes = input.implementationNotes;
    }
    if (input.reviewReport !== undefined) state.reviewReport = input.reviewReport;
    if (input.clearOpenIssues) state.openIssues = [];
    if (input.openIssues) state.openIssues = input.openIssues;
    if (input.appendOpenIssue) {
      state.openIssues = [...state.openIssues, input.appendOpenIssue];
    }

    state.updatedAt = new Date().toISOString();
    await ctx.host.kv.put(PIPELINE_KV_KEY, state);

    return { ok: true, remainingMilestones: remainingMilestones(state), state };
  },
});
