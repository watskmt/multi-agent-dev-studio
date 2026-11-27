import { defineAgent } from "@grok/agent-sdk";
import { resolveRoleModel } from "../../lib/models";

export default defineAgent({
  description:
    "プロダクト仕様の作成: 要件、ユーザーストーリー、API/データモデル、非機能要件、受け入れ基準。実装コードは書かない。",
  model: resolveRoleModel("spec-architect"),
});