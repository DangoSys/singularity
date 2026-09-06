import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/graph/types.d.ts
type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'failed';
type EdgeKind = 'spawn' | 'handoff';
type NodeShape = 'card' | 'circle' | 'diamond';
interface CanvasNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shape: NodeShape;
}
interface AgentNode {
  readonly id: SessionId;
  readonly name: string;
  readonly status: AgentStatus;
  /** Agent-selected canvas geometry and appearance. Required for new agents. */
  readonly node?: CanvasNode;
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
  readonly kind: 'agent/node';
  readonly agentId: SessionId;
  readonly node: CanvasNode;
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
export { GraphConfig as a, GraphSnapshot as c, EdgeKind as i, GroupNode as l, AgentStatus as n, GraphEdge as o, CanvasNode as r, GraphEvent as s, AgentNode as t, NodeShape as u };