import { readFileSync } from "node:fs";
import { defineEval } from "@grok/agent-sdk/evals";
import {
  gradeMessage,
  inputTokens,
  parseHidden,
  pipelineToolStats,
  subagentRestarts,
  subagentSequence,
  type Ev,
} from "./_shared/metrics";

/**
 * 難しい比較 eval。受け入れ基準には書かず、仕様の本文にだけある要件を
 * 7 つ破った在庫予約モジュールを渡す（数量の型、並行予約の超過、キャンセルの
 * 冪等性、15 分ちょうどの失効、割引の切り捨て、割引率の範囲、備考の XSS）。
 * 付属テストは AC だけを見るので全部通る。
 *
 * 採点は 8 項目（basic + 上記 7）。採点スクリプトは作業後に初めて見せる。
 *
 * 実行例:
 *   DEV_STUDIO_MODEL_IMPLEMENT=composer-2.5 npm run eval:hard
 *   DEV_STUDIO_MODEL_IMPLEMENT=claude-sonnet-5-5 npm run eval:hard -- compare-hard/pipeline
 */

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/inventory/${name}`, import.meta.url), "utf8");

const WORKSPACE = {
  "docs/SPEC.md": fixture("SPEC.md"),
  "inventory.py": fixture("inventory.py"),
  "pricing.py": fixture("pricing.py"),
  "render.py": fixture("render.py"),
  "tests/__init__.py": "",
  "tests/test_basic.py": fixture("test_basic.py"),
};

const GRADER = readFileSync(new URL("./_shared/inventory_grader.py", import.meta.url), "utf8");

const TASK =
  "リリース前の仕上げです。ワークスペースの在庫予約モジュールが docs/SPEC.md の仕様をすべて満たしているか確認し、" +
  "満たしていない点があれば直して完成させてください。仕様は確定済みなので spec フェーズは省略してよいです。";

export default defineEval({
  tags: ["compare-hard"],
  timeoutMs: 60 * 60 * 1000,
  iterations: 2,
  cases: [
    {
      id: "pipeline",
      description: "マルチエージェント（implement → review）で、AC に書かれていない要件違反を直せるか。",
      async test(t) {
        const work = await t.send(TASK, { workspaceFiles: WORKSPACE });
        const ev = work.events as readonly Ev[];
        const seq = subagentSequence(ev);
        const tools = pipelineToolStats(ev);
        t.log(`subagents: ${seq.join(" → ") || "(none)"}  restarts=${subagentRestarts(ev)}`);
        t.log(`pipeline tools: ${tools.total} calls, ${tools.failed} failed/rejected`);
        t.log(`input tokens (work turn): ${inputTokens(ev)}`);
        t.calledSubagent("implementer");
        t.calledSubagent("reviewer");
        t.eventsSatisfy("最後のサブエージェントが reviewer", () => seq.at(-1) === "reviewer");
        t.eventsSatisfy("同じサブエージェントを続けて呼んでいない", () =>
          seq.every((n, i) => i === 0 || seq[i - 1] !== n),
        );
        t.score("pipeline_tool_success", tools.total ? 1 - tools.failed / tools.total : 0).soft();

        const grade = await t.send(gradeMessage(GRADER));
        const h = parseHidden(grade.message ?? "");
        t.log(`hidden grader: ${h.passed}/${h.total}  ${h.detail}`);
        t.score("hidden_requirements_met", h.total ? h.passed / h.total : 0).atLeast(1);
      },
    },
    {
      id: "single",
      description: "ベースライン: オーケストレーター単独で同じ課題を解く。",
      async test(t) {
        const work = await t.send(
          TASK +
            "今回は比較実験のため、サブエージェント（task）と pipeline_* ツールは使わず、あなた自身で実装・確認まで行ってください。",
          { workspaceFiles: WORKSPACE },
        );
        const ev = work.events as readonly Ev[];
        t.log(`input tokens (work turn): ${inputTokens(ev)}`);
        t.eventsSatisfy("サブエージェントを呼んでいない", () => subagentSequence(ev).length === 0);

        const grade = await t.send(gradeMessage(GRADER));
        const h = parseHidden(grade.message ?? "");
        t.log(`hidden grader: ${h.passed}/${h.total}  ${h.detail}`);
        t.score("hidden_requirements_met", h.total ? h.passed / h.total : 0).atLeast(1);
      },
    },
  ],
});
