import { Context, Service } from "@deepseek-ai/cordis";
import { ContentBlock } from "@deepseek-ai/dsh-llm";
import { Session, SessionId as SessionId$1 } from "@deepseek-ai/dsh-session";
import { Agent, AgentHandle, AgentOptions } from "@deepseek-ai/dsh-agent";
import { GroupNode } from "@dangosys/dsh-singularity-graph";
import { CanvasNode } from "@dangosys/dsh-singularity-layout";

//#region src/types.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    agentRuntime: AgentRuntime;
    sessionVisibility: SessionVisibility;
  }
}
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    relay: {
      kind: 'relay';
      from: SessionId$1;
      to: SessionId$1;
    };
    group: {
      kind: 'group';
      agentId: SessionId$1;
    };
  }
}
interface SessionVisibility {
  readonly isVisible: (sessionId: SessionId$1) => boolean;
}
interface RootRequest {
  readonly sessionId: SessionId$1;
  readonly agentOptions?: AgentOptions;
}
interface SpawnRequest {
  readonly sessionId: SessionId$1;
  readonly name: string;
  readonly prompt: readonly ContentBlock[];
  readonly agentOptions?: AgentOptions;
  readonly signal?: AbortSignal;
}
interface GroupRequest {
  readonly id: string;
  readonly transcriptId: SessionId$1;
}
interface GroupHandle {
  readonly group: GroupNode;
  readonly transcript: Session;
}
interface RelayRequest {
  readonly from: Agent;
  readonly to: Agent;
  readonly prompt: readonly ContentBlock[];
}
//#endregion
//#region src/index.d.ts
declare class AgentRuntime extends Service {
  static inject: string[];
  private readonly owned;
  private readonly roots;
  private readonly handles;
  private readonly transcripts;
  constructor(ctx: Context);
  createRoot(request: RootRequest): Promise<AgentHandle>;
  promoteRoot(agent: Agent): Promise<void>;
  spawn(parent: Agent, request: SpawnRequest): Promise<AgentHandle>;
  destroySession(sessionId: string): Promise<void>;
  createGroup(router: Agent, request: GroupRequest): Promise<GroupHandle>;
  addMember(groupId: string, member: Agent): Promise<void>;
  handoff(parent: Agent, child: Agent, brief?: string): Promise<void>;
  relay(request: RelayRequest): Promise<void>;
  prompt(router: Agent, prompt: readonly ContentBlock[]): Promise<void>;
  private live;
}
//#endregion
export { type AgentOptions, AgentRuntime, AgentRuntime as default, type CanvasNode, type ContentBlock, type GroupHandle, type GroupRequest, type RelayRequest, type RootRequest, type SessionVisibility, type SpawnRequest };