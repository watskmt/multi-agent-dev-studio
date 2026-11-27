import { defineEval } from "@grok/agent-sdk/evals";

/**
 * 単一エージェントとマルチエージェント・パイプラインの比較。
 *
 * 既知のバグを 3 つ仕込んだ小さな Python プロジェクトを渡し、
 * 「仕様どおりに直して完成させる」よう依頼する。最後に、エージェントに
 * 見せていない採点スクリプトを実行させ、バグごとの合否を点数にする。
 *
 * 実行: npm run eval:compare
 * （本番の .agent-serve と KV を共有しないよう state-root を分けている）
 */

const SPEC = `# 割り勘ツール 仕様

## 機能
1. \`bill.split_bill(total_yen: int, people: int) -> list[int]\`
   - 合計 \`total_yen\` を \`people\` 人で割り勘した各人の金額を返す。
   - **返した金額の合計は必ず \`total_yen\` と一致する。** 割り切れない端数は先頭の人から 1 円ずつ多く払う（降順に並ぶ）。
   - \`people\` が 1 未満、または \`total_yen\` が負なら \`ValueError\`。
2. \`render.render_receipt(name: str, amount: int) -> str\`
   - \`<p>{name}: {amount}円</p>\` の HTML を返す。
   - \`name\` は利用者の入力なので **HTML エスケープする**。

## 受け入れ基準
- AC1: split_bill(1000, 3) == [334, 333, 333]
- AC2: split_bill(1000, 0) は ValueError
- AC3: render_receipt("<b>x</b>", 1) に生の "<b>" が含まれない
`;

// 仕込んだバグ: 端数の切り捨て（合計が合わない）、people=0 で ZeroDivisionError、XSS
const BILL_PY = `def split_bill(total_yen: int, people: int) -> list[int]:
    share = total_yen // people
    return [share] * people
`;

const RENDER_PY = `def render_receipt(name: str, amount: int) -> str:
    return f"<p>{name}: {amount}円</p>"
`;

// 弱いテスト（バグがあっても通る）
const TEST_PY = `import unittest
from bill import split_bill
from render import render_receipt


class BillTest(unittest.TestCase):
    def test_even_split(self):
        self.assertEqual(split_bill(1000, 2), [500, 500])

    def test_render(self):
        self.assertIn("1円", render_receipt("taro", 1))


if __name__ == "__main__":
    unittest.main()
`;

const WORKSPACE = {
  "docs/SPEC.md": SPEC,
  "bill.py": BILL_PY,
  "render.py": RENDER_PY,
  "tests/__init__.py": "",
  "tests/test_bill.py": TEST_PY,
};

const TASK =
  "ワークスペースの割り勘ツールを docs/SPEC.md の仕様どおりに完成させてください。" +
  "仕様は確定済みなので spec フェーズは省略してよいです。";

// 採点スクリプト。エージェントには 2 回目の送信で初めて見せる。
const GRADER = [
  "python3 - <<'PY'",
  "import sys; sys.path.insert(0, '.')",
  "r = []",
  "try:",
  "    from bill import split_bill",
  "    a = split_bill(1000, 3)",
  "    r.append(('sum', a == [334, 333, 333] and sum(split_bill(1001, 7)) == 1001))",
  "except Exception:",
  "    r.append(('sum', False))",
  "try:",
  "    from bill import split_bill",
  "    try:",
  "        split_bill(1000, 0)",
  "        ok = False",
  "    except ValueError:",
  "        ok = True",
  "    r.append(('zero', ok))",
  "except Exception:",
  "    r.append(('zero', False))",
  "try:",
  "    from render import render_receipt",
  "    r.append(('xss', '<script>' not in render_receipt('<script>x</script>', 1)))",
  "except Exception:",
  "    r.append(('xss', False))",
  "print('HIDDEN ' + ' '.join(k + '=' + ('PASS' if v else 'FAIL') for k, v in r))",
  "PY",
].join("\n");

const GRADE_MESSAGE =
  "コードは一切変更せず、次のコマンドをワークスペース直下で shell からそのまま実行し、" +
  "出力の HIDDEN で始まる行だけを返答してください。サブエージェントは呼ばないでください。\n\n" +
  "```bash\n" +
  GRADER +
  "\n```";

type Ev = { type: string; data?: Record<string, unknown> };

function parseHidden(text: string): { passed: number; total: number } {
  const line = text.split("\n").find((l) => l.includes("HIDDEN")) ?? "";
  const marks = [...line.matchAll(/=(PASS|FAIL)/g)].map((m) => m[1]);
  return { passed: marks.filter((m) => m === "PASS").length, total: 3 };
}

/** サブエージェント呼び出しの名前列（同じ callId の再起動は 1 回に数える） */
function subagentSequence(events: readonly Ev[]): string[] {
  const seen = new Set<string>();
  const seq: string[] = [];
  for (const e of events) {
    if (e.type !== "subagent.called") continue;
    const callId = String(e.data?.callId ?? "");
    if (callId && seen.has(callId)) continue;
    seen.add(callId);
    seq.push(String(e.data?.name ?? "?"));
  }
  return seq;
}

function pipelineToolStats(events: readonly Ev[]) {
  let total = 0;
  let failed = 0;
  for (const e of events) {
    if (e.type !== "action.result") continue;
    const name = String(e.data?.toolName ?? "");
    if (!name.startsWith("pipeline_")) continue;
    total += 1;
    if (e.data?.isError === true) failed += 1;
  }
  return { total, failed };
}

function inputTokens(events: readonly Ev[]): number {
  let sum = 0;
  for (const e of events) {
    if (e.type !== "turn.completed") continue;
    const u = e.data?.usage as { inputTokens?: number } | undefined;
    sum += u?.inputTokens ?? 0;
  }
  return sum;
}

export default defineEval({
  tags: ["compare"],
  timeoutMs: 60 * 60 * 1000,
  cases: [
  {
    id: "pipeline",
    description: "マルチエージェント（implement → review → 差し戻し）でバグ入り課題を完成させる。",
    async test(t) {
      const work = await t.send(TASK, { workspaceFiles: WORKSPACE });
      const workEvents = work.events as readonly Ev[];

      const seq = subagentSequence(workEvents);
      t.log(`subagents: ${seq.join(" → ") || "(none)"}`);
      t.calledSubagent("implementer");
      t.calledSubagent("reviewer");
      // 最後の担当はレビュー（実装担当で終わらない）
      t.eventsSatisfy("最後のサブエージェントが reviewer", () => seq.at(-1) === "reviewer");
      t.eventsSatisfy("同じサブエージェントを続けて呼んでいない", () =>
        seq.every((name, i) => i === 0 || seq[i - 1] !== name),
      );

      const tools = pipelineToolStats(workEvents);
      t.log(`pipeline tools: ${tools.total} calls, ${tools.failed} failed`);
      t.score("pipeline_tool_success", tools.total ? 1 - tools.failed / tools.total : 0);
      t.log(`input tokens (work turn): ${inputTokens(workEvents)}`);

      const grade = await t.send(GRADE_MESSAGE);
      const { passed, total } = parseHidden(grade.message ?? "");
      t.log(`hidden grader: ${passed}/${total}  (${(grade.message ?? "").trim().slice(0, 120)})`);
      t.score("hidden_bugs_fixed", passed / total).atLeast(1);
    },
  },
  {
    id: "single",
    description: "ベースライン: サブエージェントを使わず、オーケストレーター単独で同じ課題を解く。",
    async test(t) {
      const work = await t.send(
        TASK +
          "今回は比較実験のため、サブエージェント（task）と pipeline_* ツールは使わず、あなた自身で実装・確認まで行ってください。",
        { workspaceFiles: WORKSPACE },
      );
      const workEvents = work.events as readonly Ev[];
      t.eventsSatisfy("サブエージェントを呼んでいない", () => subagentSequence(workEvents).length === 0);
      t.log(`input tokens (work turn): ${inputTokens(workEvents)}`);

      const grade = await t.send(GRADE_MESSAGE);
      const { passed, total } = parseHidden(grade.message ?? "");
      t.log(`hidden grader: ${passed}/${total}  (${(grade.message ?? "").trim().slice(0, 120)})`);
      t.score("hidden_bugs_fixed", passed / total).atLeast(1);
    },
  },
  ],
});
