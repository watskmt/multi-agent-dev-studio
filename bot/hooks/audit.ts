import { defineHook } from "@grok/agent-sdk/hooks";
import {
  appendAuditRecord,
  readPipelineSnapshot,
  type AuditRecord,
} from "../lib/audit-log";
import { resolveSharedModelId } from "../lib/models";

type TurnCompletedData = {
  result?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  cost?: {
    model?: string;
    totalUsd?: number;
  };
};

const PIPELINE_TOOLS = new Set([
  "pipeline_get",
  "pipeline_update",
  "pipeline_handoff",
]);

function base(
  event: { sessionId: string; turnId?: string },
  ctx: { session: { id: string } },
): Pick<AuditRecord, "at" | "sessionId" | "turnId"> {
  return {
    at: new Date().toISOString(),
    sessionId: ctx.session.id,
    turnId: event.turnId,
  };
}

export default defineHook({
  events: {
    async "turn.completed"(event, ctx) {
      const data = event.data as TurnCompletedData;
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "turn",
        status: "completed",
        model: data.cost?.model,
        configuredModel: resolveSharedModelId(),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        usage: data.usage
          ? {
              inputTokens: data.usage.inputTokens,
              outputTokens: data.usage.outputTokens,
            }
          : undefined,
        detail:
          data.result !== undefined
            ? data.result.slice(0, 500)
            : undefined,
      });
    },
    async "turn.failed"(event, ctx) {
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "turn",
        status: "failed",
        configuredModel: resolveSharedModelId(),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        detail: event.data.message?.slice(0, 500),
      });
    },
    async "subagent.called"(event, ctx) {
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "subagent",
        subagentEvent: "started",
        subagent: event.data.name,
        callId: event.data.callId,
        configuredModel: resolveSharedModelId(),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        detail: event.data.description?.slice(0, 300),
      });
    },
    async "subagent.completed"(event, ctx) {
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "subagent",
        subagentEvent: "finished",
        status: event.data.isError ? "failed" : "completed",
        subagent: event.data.name,
        callId: event.data.callId,
        configuredModel: resolveSharedModelId(),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
      });
    },
    async "action.result"(event, ctx) {
      const { toolName, callId, isError, parentCallId } = event.data;
      if (!PIPELINE_TOOLS.has(toolName)) return;
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      const output =
        typeof event.data.output === "string"
          ? event.data.output.slice(0, 400)
          : JSON.stringify(event.data.output ?? {}).slice(0, 400);
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "tool",
        status: isError ? "failed" : "completed",
        toolName,
        callId,
        configuredModel: resolveSharedModelId(),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        detail: parentCallId
          ? `parentCallId=${parentCallId} ${output}`
          : output,
      });
    },
  },
});