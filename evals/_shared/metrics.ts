/** 比較 eval 共通の集計ヘルパー（*.eval.ts ではないので case としては発見されない） */

export type Ev = { type: string; data?: Record<string, unknown> };

/** サブエージェント呼び出しの名前列（同じ callId の再起動は 1 回に数える） */
export function subagentSequence(events: readonly Ev[]): string[] {
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

/** 同じ callId でのサブエージェント再起動の回数 */
export function subagentRestarts(events: readonly Ev[]): number {
  const ids = events
    .filter((e) => e.type === "subagent.called")
    .map((e) => String(e.data?.callId ?? ""));
  return ids.length - new Set(ids).size;
}

export function pipelineToolStats(events: readonly Ev[]) {
  let total = 0;
  let failed = 0;
  for (const e of events) {
    if (e.type !== "action.result") continue;
    const name = String(e.data?.toolName ?? "");
    if (!name.startsWith("pipeline_")) continue;
    total += 1;
    const out = e.data?.output as { ok?: unknown } | undefined;
    if (e.data?.isError === true || (out && typeof out === "object" && out.ok === false)) failed += 1;
  }
  return { total, failed };
}

export function inputTokens(events: readonly Ev[]): number {
  let sum = 0;
  for (const e of events) {
    if (e.type !== "turn.completed") continue;
    const u = e.data?.usage as { inputTokens?: number } | undefined;
    sum += u?.inputTokens ?? 0;
  }
  return sum;
}

/** 採点スクリプトの出力（HIDDEN k=PASS ...）を読む */
export function parseHidden(text: string): { passed: number; total: number; detail: string } {
  const line = text.split("\n").find((l) => l.includes("HIDDEN")) ?? "";
  const marks = [...line.matchAll(/(\w+)=(PASS|FAIL)/g)];
  return {
    passed: marks.filter((m) => m[2] === "PASS").length,
    total: marks.length,
    detail: line.trim(),
  };
}

export function gradeMessage(graderSource: string): string {
  return (
    "コードは一切変更せず、次のコマンドをワークスペース直下で shell からそのまま実行し、" +
    "出力の HIDDEN で始まる行だけを返答してください。サブエージェントは呼ばないでください。\n\n" +
    "```bash\npython3 - <<'PY'\n" +
    graderSource.trimEnd() +
    "\nPY\n```"
  );
}
