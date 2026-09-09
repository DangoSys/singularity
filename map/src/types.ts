export type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'failed'
export type EdgeKind = 'spawn' | 'handoff'
export type NodeShape = 'card' | 'circle' | 'diamond'

export interface AgentNode {
  readonly id: string
  readonly name: string
  readonly status: AgentStatus
  readonly memberOf?: string
  readonly routerFor?: string
}

export interface GroupNode {
  readonly id: string
  readonly routerId: string
  readonly transcriptId: string
  readonly memberIds: readonly string[]
}

export interface GraphEdge {
  readonly id: string
  readonly kind: EdgeKind
  readonly from: string
  readonly to: string
  readonly brief?: string
}

export interface GraphSnapshot {
  readonly version: 1
  readonly id: string
  readonly roots: readonly string[]
  readonly agents: readonly AgentNode[]
  readonly groups: readonly GroupNode[]
  readonly edges: readonly GraphEdge[]
}

export interface CanvasNode {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly shape: NodeShape
}

export interface LayoutSnapshot {
  readonly version: 1
  readonly id: string
  readonly nodes: Readonly<Record<string, CanvasNode>>
}

export interface AgentData extends AgentNode {
  readonly width: number
  readonly height: number
  readonly shape: NodeShape
  readonly root: boolean
}
