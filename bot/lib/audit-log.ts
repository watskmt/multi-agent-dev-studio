import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PIPELINE_KV_KEY, type PipelineState } from "./pipeline";

const MEMORY_DIR = "memory";
const AUDIT_FILENAME = "audit.jsonl";

export type AuditRecord = {
  at: string;
  kind: "turn" | "subagent" | "tool";
  sessionId: string;
  turnId?: string;
  status?: "completed" | "failed";
  /** 実際に課金・実行されたモデル（turn.completed の cost があれば） */
  model?: string;
  /** agent.ts / DEV_STUDIO_MODEL で設定した共有モデル */
  configuredModel?: string;
  subagent?: string;
  /** subagent: called → started, completed → finished */
  subagentEvent?: "started" | "finished";
  callId?: string;
  toolName?: string;
  pipelinePhase?: string;
  projectName?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  detail?: string;
};

const appendChains = new Map<string, Promise<void>>();

export async function appendAuditRecord(
  stateRoot: string,
  record: AuditRecord,
): Promise<void> {
  const dir = join(stateRoot, MEMORY_DIR);
  const path = join(dir, AUDIT_FILENAME);
  const prior = appendChains.get(path) ?? Promise.resolve();
  const next = prior
    .catch(() => {})
    .then(async () => {
      await mkdir(dir, { recursive: true });
      await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
    });
  appendChains.set(path, next);
  await next;
}

export async function readAuditTail(
  stateRoot: string,
  limit: number,
): Promise<AuditRecord[]> {
  const path = join(stateRoot, MEMORY_DIR, AUDIT_FILENAME);
  const raw = await readFile(path, "utf8").catch(() => "");
  if (!raw) return [];
  const lines = raw.trim().split("\n").filter(Boolean);
  const slice = lines.slice(-Math.max(1, Math.min(limit, 200)));
  const out: AuditRecord[] = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line) as AuditRecord);
    } catch {
      // skip corrupt line
    }
  }
  return out;
}

export async function readPipelineSnapshot(
  kvGet: (key: string) => Promise<unknown>,
): Promise<Pick<PipelineState, "phase" | "projectName"> | undefined> {
  const raw = await kvGet(PIPELINE_KV_KEY);
  if (raw === undefined) return undefined;
  const state = raw as PipelineState;
  return { phase: state.phase, projectName: state.projectName };
}