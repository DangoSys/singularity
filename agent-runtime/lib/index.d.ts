import { Context, Service } from "@deepseek-ai/cordis";
import { ContentBlock } from "@deepseek-ai/dsh-llm";
import { SessionId, SessionId as SessionId$1 } from "@deepseek-ai/dsh-session";
import { CanvasNode } from "@dangosys/dsh-singularity-layout";
import { Agent, AgentHandle, AgentOptions } from "@deepseek-ai/dsh-agent";

//#region src/types.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    agentRuntime: AgentRuntime;
    sessionVisibility: SessionVisibility;
  }
}
interface SessionVisibility {
  readonly isVisible: (sessionId: SessionId$1) => boolean;
}
interface RootRequest {
  readonly sessionId: SessionId$1;
  readonly agentOptions?: AgentOptions;
  readonly agentPreset?: string;
}
interface SpawnRequest {
  readonly sessionId: SessionId$1;
  readonly name: string;
  readonly prompt: readonly ContentBlock[];
  readonly agentOptions?: AgentOptions;
  readonly signal?: AbortSignal;
}
//#endregion
//#region src/index.d.ts
declare class AgentRuntime extends Service {
  static inject: string[];
  private readonly owned;
  private readonly roots;
  private readonly handles;
  constructor(ctx: Context);
  ensureRoot(sessionId: SessionId): Promise<AgentHandle>;
  createRoot(request: RootRequest): Promise<AgentHandle>;
  spawn(parent: Agent, request: SpawnRequest): Promise<AgentHandle>;
  stopAgents(sessionIds: readonly SessionId[]): Promise<void>;
  prompt(agent: Agent, prompt: readonly ContentBlock[]): Promise<void>;
  private live;
}
//#endregion
export { type AgentOptions, AgentRuntime, AgentRuntime as default, type CanvasNode, type ContentBlock, type RootRequest, type SessionVisibility, type SpawnRequest };