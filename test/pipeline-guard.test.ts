import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_SUBAGENT_STALE_MS,
  applyHandoff,
  checkCompleteMilestone,
  checkHandoff,
  checkNotInSubagent,
  emptyPipeline,
  type DevPhase,
  type PipelineState,
  type ReviewVerdict,
} from "../bot/lib/pipeline";

function at(phase: DevPhase, verdict?: ReviewVerdict): PipelineState {
  const s = emptyPipeline("goal", "proj");
  s.phase = phase;
  if (verdict) s.lastReviewVerdict = verdict;
  return s;
}

test("通常の流れ intake→spec→implement→review→done を通せる", () => {
  let s = at("intake");
  for (const to of ["spec", "implement", "review"] as const) {
    assert.equal(checkHandoff(s, to).ok, true, `→${to}`);
    s = applyHandoff(s, to, "x", new Date().toISOString()).state;
  }
  s.lastReviewVerdict = "approve_with_nits";
  assert.equal(checkHandoff(s, "done").ok, true);
  assert.equal(s.reviewRounds, 1);
});

test("同じフェーズへの handoff（review→review）を拒否する", () => {
  assert.equal(checkHandoff(at("review", "request_changes"), "review").ok, false);
  assert.equal(checkHandoff(at("implement"), "implement").ok, false);
});

test("implement から done へ直行できない（最後は必ず review）", () => {
  assert.equal(checkHandoff(at("implement"), "done").ok, false);
  assert.equal(checkHandoff(at("spec"), "done").ok, false);
});

test("判定未記録のまま review から移れない", () => {
  assert.equal(checkHandoff(at("review"), "implement").ok, false);
  assert.equal(checkHandoff(at("review"), "done").ok, false);
});

test("request_changes では done にできず、差し戻しはできる", () => {
  assert.equal(checkHandoff(at("review", "request_changes"), "done").ok, false);
  assert.equal(checkHandoff(at("review", "request_changes"), "implement").ok, true);
});

test("差し戻し後は判定が消え、再レビューで取り直しが必要", () => {
  const s = applyHandoff(at("review", "approve"), "implement", "x", "2026-01-01T00:00:00Z").state;
  assert.equal(s.lastReviewVerdict, undefined);
  const r = applyHandoff(s, "review", "x", "2026-01-01T00:01:00Z").state;
  assert.equal(checkHandoff(r, "done").ok, false);
});

test("サブエージェント実行中は書き込みを拒否し、古いフラグは無視する", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  assert.equal(checkNotInSubagent(undefined, now).ok, true);
  assert.equal(
    checkNotInSubagent({ name: "implementer", at: "2026-01-01T11:59:00Z" }, now).ok,
    false,
  );
  const stale = new Date(now - ACTIVE_SUBAGENT_STALE_MS - 1000).toISOString();
  assert.equal(checkNotInSubagent({ name: "implementer", at: stale }, now).ok, true);
});

test("未完了のマイルストーンが残っていると done にできない", () => {
  const s = at("review", "approve");
  s.milestones = ["M1", "M2"];
  s.completedMilestones = ["M1"];
  assert.equal(checkHandoff(s, "done").ok, false);
  s.completedMilestones = ["M1", "M2"];
  assert.equal(checkHandoff(s, "done").ok, true);
});

test("マイルストーンの完了は review で approve 系のときだけ記録できる", () => {
  const s = at("review", "request_changes");
  s.milestones = ["M1"];
  assert.equal(checkCompleteMilestone(s, "M1").ok, false);
  s.lastReviewVerdict = "approve";
  assert.equal(checkCompleteMilestone(s, "M1").ok, true);
  assert.equal(checkCompleteMilestone(s, "M9").ok, false);
  assert.equal(checkCompleteMilestone(at("implement"), "M1").ok, false);
});
