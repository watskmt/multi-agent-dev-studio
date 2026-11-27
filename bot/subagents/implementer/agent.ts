import { defineAgent } from "@grok/agent-sdk";
import { MODEL_POLICY } from "../../lib/models";

export default defineAgent({
  description:
    "確定した仕様に基づく実装。ワークスペースにファイルを作成・編集し、必要ならシェルでビルドやテストを実行する。",
  model: {
    id: MODEL_POLICY.implementer.id,
  },
});