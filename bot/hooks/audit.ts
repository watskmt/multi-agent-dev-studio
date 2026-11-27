import { defineHook } from "@grok/agent-sdk/hooks";
import {
  appendAuditRecord,
  readPipelineSnapshot,
  type AuditRecord,
} from "../lib/audit-log";
import {
  configuredModelForSubagent,
  modelIdForLog,
  resolveRoleModel,
} from "../lib/models";

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

/** サブエージェント実行中のターンに、その役割の configuredModel を付ける */
const activeSubagentBySession = new Map<
  string,
  { name: string; configuredModel: string }
>();

function configuredModelForTurn(
  sessionId: string,
  subagentName?: string,
): string {
  if (subagentName) {
    const roleModel = configuredModelForSubagent(subagentName);
    if (roleModel) return roleModel;
  }
  const active = activeSubagentBySession.get(sessionId);
  if (active) return active.configuredModel;
  return modelIdForLog(resolveRoleModel("orchestrator"));
}

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
        configuredModel: configuredModelForTurn(ctx.session.id),
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
        configuredModel: configuredModelForTurn(ctx.session.id),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        detail: event.data.message?.slice(0, 500),
      });
    },
    async "subagent.called"(event, ctx) {
      const pipeline = await readPipelineSnapshot((key) => ctx.host.kv.get(key));
      const configuredModel = configuredModelForTurn(
        ctx.session.id,
        event.data.name,
      );
      if (event.data.name) {
        activeSubagentBySession.set(ctx.session.id, {
          name: event.data.name,
          configuredModel,
        });
      }
      await appendAuditRecord(ctx.stateRoot, {
        ...base(event, ctx),
        kind: "subagent",
        subagentEvent: "started",
        subagent: event.data.name,
        callId: event.data.callId,
        configuredModel,
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
        configuredModel: configuredModelForTurn(
          ctx.session.id,
          event.data.name,
        ),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
      });
      activeSubagentBySession.delete(ctx.session.id);
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
        configuredModel: modelIdForLog(resolveRoleModel("orchestrator")),
        pipelinePhase: pipeline?.phase,
        projectName: pipeline?.projectName,
        detail: parentCallId
          ? `parentCallId=${parentCallId} ${output}`
          : output,
      });
    },
  },
});