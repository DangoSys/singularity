import type { Agent, AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SessionId, Session } from '@deepseek-ai/dsh-session'
import type { CanvasNode, GraphEvent, GraphSnapshot, GroupNode } from '../graph/types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    agentRuntime: import('./index.ts').AgentRuntime
    sessionVisibility: SessionVisibility
  }
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    relay: { kind: 'relay'; from: SessionId; to: SessionId }
    group: { kind: 'group'; agentId: SessionId }
  }
}

export interface SessionVisibility {
  readonly isVisible: (sessionId: SessionId) => boolean
}

export interface RootRequest {
  readonly sessionId: SessionId
  readonly agentOptions?: AgentOptions
  readonly node: CanvasNode
}
export interface SpawnRequest {
  readonly sessionId: SessionId
  readonly name: string
  readonly prompt: readonly ContentBlock[]
  readonly agentOptions?: AgentOptions
  readonly node: CanvasNode
  readonly signal?: AbortSignal
}
export interface GroupRequest {
  readonly id: string
  readonly transcriptId: SessionId
}
export interface GroupHandle {
  readonly group: GroupNode
  readonly transcript: Session
}
export interface RelayRequest {
  readonly from: Agent
  readonly to: Agent
  readonly prompt: readonly ContentBlock[]
}

export type { Agent, AgentHandle, AgentOptions, CanvasNode, ContentBlock, GraphEvent, GraphSnapshot, GroupNode, SessionId, Session }
