import { a as GraphConfig, c as GraphSnapshot, i as EdgeKind, l as GroupNode, n as AgentStatus, o as GraphEdge, r as CanvasNode, s as GraphEvent, t as AgentNode, u as NodeShape } from "../types-CqjtXFAV.js";
import { Context, Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/graph/state.d.ts
declare class GraphState {
  private value;
  constructor(id: string, snapshot?: GraphSnapshot);
  clone(): GraphState;
  snapshot(): GraphSnapshot;
  apply(event: GraphEvent): void;
  private addAgent;
  private status;
  private setNode;
  private addGroup;
  private addMember;
  private addEdge;
  private reaches;
  private agent;
  private group;
  private node;
}
//#endregion
//#region src/graph/index.d.ts
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
  setNode(agentId: SessionId, node: CanvasNode): Promise<void>;
  addGroup(group: GroupNode): Promise<void>;
  addMember(groupId: string, agentId: SessionId): Promise<void>;
  addEdge(edge: GraphEdge): Promise<void>;
  commit(events: readonly GraphEvent[]): Promise<void>;
  private open;
  private header;
}
//#endregion
export { AgentNode, AgentStatus, CanvasNode, EdgeKind, GraphConfig, GraphEdge, GraphEvent, GraphService, GraphService as default, GraphSnapshot, GraphState, GroupNode, NodeShape };