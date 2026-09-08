import { Context, Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/types.d.ts
type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'failed';
type EdgeKind = 'spawn' | 'handoff';
interface AgentNode {
  readonly id: SessionId;
  readonly name: string;
  readonly status: AgentStatus;
  /** The one parent group this agent is a member of; a router's own group is routerFor. */
  readonly memberOf?: string;
  /** The group this agent leads as router. */
  readonly routerFor?: string;
}
interface GroupNode {
  readonly id: string;
  readonly routerId: SessionId;
  readonly transcriptId: SessionId;
  readonly memberIds: readonly SessionId[];
}
interface GraphEdge {
  readonly id: string;
  readonly kind: EdgeKind;
  readonly from: SessionId;
  readonly to: SessionId;
  readonly brief?: string;
}
interface GraphSnapshot {
  readonly version: 1;
  readonly id: string;
  readonly roots: readonly SessionId[];
  readonly agents: readonly AgentNode[];
  readonly groups: readonly GroupNode[];
  readonly edges: readonly GraphEdge[];
}
type GraphEvent = {
  readonly kind: 'agent/add';
  readonly agent: AgentNode;
  readonly root?: true;
} | {
  readonly kind: 'agent/status';
  readonly agentId: SessionId;
  readonly status: AgentStatus;
} | {
  readonly kind: 'group/add';
  readonly group: GroupNode;
} | {
  readonly kind: 'member/add';
  readonly groupId: string;
  readonly agentId: SessionId;
} | {
  readonly kind: 'edge/add';
  readonly edge: GraphEdge;
};
interface GraphConfig {
  readonly storeId?: string;
}
//#endregion
//#region src/service/state.d.ts
declare class GraphState {
  private value;
  constructor(id: string, snapshot?: GraphSnapshot);
  clone(): GraphState;
  snapshot(): GraphSnapshot;
  apply(event: GraphEvent): void;
  private addAgent;
  private status;
  private addGroup;
  private addMember;
  private addEdge;
  private reaches;
  private agent;
  private group;
}
//#endregion
//#region src/index.d.ts
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'graph/event': GraphEvent;
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    graph: GraphService;
  }
  interface Events {
    'graph/change'(snapshot: GraphSnapshot): void;
  }
}
declare class GraphService extends Service {
  static inject: string[];
  private readonly ready;
  private readonly storeId;
  private handle;
  private state;
  private nextSeq;
  private writes;
  constructor(ctx: Context, config?: GraphConfig);
  snapshot(): Promise<GraphSnapshot>;
  addAgent(agent: AgentNode, root?: boolean): Promise<void>;
  setStatus(agentId: SessionId, status: AgentStatus): Promise<void>;
  addGroup(group: GroupNode): Promise<void>;
  addMember(groupId: string, agentId: SessionId): Promise<void>;
  addEdge(edge: GraphEdge): Promise<void>;
  commit(events: readonly GraphEvent[]): Promise<void>;
  private open;
  private header;
}
//#endregion
export { AgentNode, AgentStatus, EdgeKind, GraphConfig, GraphEdge, GraphEvent, GraphService, GraphService as default, GraphSnapshot, GraphState, GroupNode };