export type DevPhase = "intake" | "spec" | "implement" | "review" | "done";

export type ReviewVerdict = "approve" | "approve_with_nits" | "request_changes";

export type HandoffRecord = {
  from: DevPhase | "user";
  to: DevPhase;
  summary: string;
  at: string;
};

export type PipelineState = {
  projectName: string;
  goal: string;
  stackNotes: string;
  phase: DevPhase;
  spec?: string;
  implementationNotes?: string;
  reviewReport?: string;
  /** 現在の review フェーズで記録された判定。review 以外へ移ると消える */
  lastReviewVerdict?: ReviewVerdict;
  /** review フェーズに入った回数 */
  reviewRounds?: number;
  /** マイルストーン ID の一覧（例: ["M1", "M2"]）。未設定なら 1 つの塊として扱う */
  milestones?: string[];
  /** レビューで approve 系が出て完了したマイルストーン */
  completedMilestones?: string[];
  /** 現在実装・レビュー中のマイルストーン */
  currentMilestone?: string;
  openIssues: string[];
  handoffs: HandoffRecord[];
  updatedAt: string;
};

export const PIPELINE_KV_KEY = "pipeline:current";

/** サブエージェント実行中フラグ（hook が書き、pipeline 書き込みツールが読む） */
export function activeSubagentKey(sessionId: string): string {
  return `pipeline:activeSubagent:${sessionId}`;
}

export type ActiveSubagent = { name: string; callId?: string; at: string };

/** これより古い実行中フラグは中断の残骸とみなして無視する */
export const ACTIVE_SUBAGENT_STALE_MS = 2 * 60 * 60 * 1000;

export function emptyPipeline(goal: string, projectName: string): PipelineState {
  const now = new Date().toISOString();
  return {
    projectName,
    goal,
    stackNotes: "未定 — 仕様フェーズで決定",
    phase: "intake",
    reviewRounds: 0,
    openIssues: [],
    handoffs: [],
    updatedAt: now,
  };
}

export function nextPhaseAfter(phase: DevPhase): DevPhase | null {
  const order: DevPhase[] = ["intake", "spec", "implement", "review", "done"];
  const i = order.indexOf(phase);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1]!;
}

/** 許可するフェーズ遷移。implement の後は必ず review を挟む */
export const ALLOWED_TRANSITIONS: Record<DevPhase, readonly DevPhase[]> = {
  intake: ["spec", "implement"],
  spec: ["implement"],
  implement: ["review"],
  review: ["implement", "spec", "done"],
  done: ["intake", "spec"],
};

export function isApproved(verdict: ReviewVerdict | undefined): boolean {
  return verdict === "approve" || verdict === "approve_with_nits";
}

export type GuardResult = { ok: true } | { ok: false; error: string };

/** pipeline_handoff の遷移ガード（純関数） */
export function checkHandoff(state: PipelineState, to: DevPhase): GuardResult {
  const from = state.phase;
  if (to === from) {
    return {
      ok: false,
      error: `同じフェーズへの handoff は禁止です（${from} → ${to}）。同じ担当を続けて呼ばず、次の担当へ渡してください。`,
    };
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      error: `${from} → ${to} は許可されていません。${from} から進めるのは ${ALLOWED_TRANSITIONS[from].join(" / ")} です。`,
    };
  }
  if (from === "review" && state.lastReviewVerdict === undefined) {
    return {
      ok: false,
      error:
        "review から移る前に、pipeline_update の reviewVerdict でレビュー判定（approve / approve_with_nits / request_changes）を記録してください。",
    };
  }
  if (to === "done" && !isApproved(state.lastReviewVerdict)) {
    return {
      ok: false,
      error: `done にできるのは最後のレビューが approve 系のときだけです（現在: ${state.lastReviewVerdict ?? "未記録"}）。implement に差し戻してください。`,
    };
  }
  if (to === "done") {
    const left = remainingMilestones(state);
    if (left.length > 0) {
      return {
        ok: false,
        error: `未完了のマイルストーンがあります: ${left.join(", ")}。approve 後は pipeline_update の completeMilestone で完了を記録し、次のマイルストーンを implement に渡してください。`,
      };
    }
  }
  return { ok: true };
}

export function remainingMilestones(state: PipelineState): string[] {
  const done = new Set(state.completedMilestones ?? []);
  return (state.milestones ?? []).filter((m) => !done.has(m));
}

/** マイルストーン完了の記録ガード（review で approve 系のときだけ） */
export function checkCompleteMilestone(state: PipelineState, id: string): GuardResult {
  if (!(state.milestones ?? []).includes(id)) {
    return { ok: false, error: `未登録のマイルストーンです: ${id}（登録済み: ${(state.milestones ?? []).join(", ") || "なし"}）` };
  }
  if (state.phase !== "review" || !isApproved(state.lastReviewVerdict)) {
    return {
      ok: false,
      error: "マイルストーンを完了にできるのは、review フェーズで approve / approve_with_nits を記録した後だけです。",
    };
  }
  return { ok: true };
}

/** handoff を状態に適用する（ガード通過後に呼ぶ） */
export function applyHandoff(
  state: PipelineState,
  to: DevPhase,
  summary: string,
  at: string,
): { state: PipelineState; record: HandoffRecord } {
  const record: HandoffRecord = { from: state.phase, to, summary, at };
  const next: PipelineState = {
    ...state,
    phase: to,
    handoffs: [...state.handoffs, record],
    updatedAt: at,
  };
  // done 以外へ移ったら判定は無効化（次の review で取り直す）
  if (to !== "done") delete next.lastReviewVerdict;
  if (to === "review") next.reviewRounds = (state.reviewRounds ?? 0) + 1;
  return { state: next, record };
}

/** サブエージェント実行中なら pipeline の書き込みを拒否する */
export function checkNotInSubagent(
  active: ActiveSubagent | undefined,
  now: number = Date.now(),
): GuardResult {
  if (!active) return { ok: true };
  const age = now - Date.parse(active.at);
  if (Number.isFinite(age) && age > ACTIVE_SUBAGENT_STALE_MS) return { ok: true };
  return {
    ok: false,
    error: `サブエージェント（${active.name}）実行中は pipeline の状態を変更できません。状態の更新はオーケストレーターが行います。サブエージェントは結果を返答に書いて終了してください。`,
  };
}
