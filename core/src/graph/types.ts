import type { SessionId } from '@deepseek-ai/dsh-session'

export type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'failed'
export type EdgeKind = 'spawn' | 'handoff'
export type NodeShape = 'card' | 'circle' | 'diamond'

export interface CanvasNode {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly shape: NodeShape
}

export interface AgentNode {
  readonly id: SessionId
  readonly name: string
  readonly status: AgentStatus
  /** Agent-selected canvas geometry and appearance. Required for new agents. */
  readonly node?: CanvasNode
  /** The one parent group this agent is a member of; a router's own group is routerFor. */
  readonly memberOf?: string
  /** The group this agent leads as router. */
  readonly routerFor?: string
}

export interface GroupNode {
  readonly id: string
  readonly routerId: SessionId
  readonly transcriptId: SessionId
  readonly memberIds: readonly SessionId[]
}

export interface GraphEdge {
  readonly id: string
  readonly kind: EdgeKind
  readonly from: SessionId
  readonly to: SessionId
  readonly brief?: string
}

export interface GraphSnapshot {
  readonly version: 1
  readonly id: string
  readonly roots: readonly SessionId[]
  readonly agents: readonly AgentNode[]
  readonly groups: readonly GroupNode[]
  readonly edges: readonly GraphEdge[]
}

export type GraphEvent =
  | { readonly kind: 'agent/add'; readonly agent: AgentNode; readonly root?: true }
  | { readonly kind: 'agent/node'; readonly agentId: SessionId; readonly node: CanvasNode }
  | { readonly kind: 'agent/status'; readonly agentId: SessionId; readonly status: AgentStatus }
  | { readonly kind: 'group/add'; readonly group: GroupNode }
  | { readonly kind: 'member/add'; readonly groupId: string; readonly agentId: SessionId }
  | { readonly kind: 'edge/add'; readonly edge: GraphEdge }

export interface GraphConfig {
  readonly storeId?: string
}
