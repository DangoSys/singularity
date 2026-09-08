import type { SessionId } from '@deepseek-ai/dsh-session'

export type NodeShape = 'card' | 'circle' | 'diamond'

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

export type LayoutEvent =
  | { readonly kind: 'node/set'; readonly sessionId: SessionId; readonly node: CanvasNode }
  | { readonly kind: 'node/remove'; readonly sessionId: SessionId }

export interface LayoutConfig {
  readonly storeId?: string
}

export const DEFAULT_ROOT: CanvasNode = { x: 80, y: 80, width: 168, height: 76, shape: 'card' }
