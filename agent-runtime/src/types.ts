import type { Agent, AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { GraphEvent } from '@dangosys/dsh-singularity-graph'
import type { CanvasNode } from '@dangosys/dsh-singularity-layout'

declare module '@deepseek-ai/cordis' {
  interface Context {
    agentRuntime: import('./index.ts').AgentRuntime
    sessionVisibility: SessionVisibility
  }
}

export interface SessionVisibility {
  readonly isVisible: (sessionId: SessionId) => boolean
}

export interface RootRequest {
  readonly sessionId: SessionId
  readonly agentOptions?: AgentOptions
  readonly agentPreset?: string
}

export interface SpawnRequest {
  readonly sessionId: SessionId
  readonly name: string
  readonly prompt: readonly ContentBlock[]
  readonly agentOptions?: AgentOptions
  readonly signal?: AbortSignal
}

export type { Agent, AgentHandle, AgentOptions, CanvasNode, ContentBlock, GraphEvent, SessionId }
