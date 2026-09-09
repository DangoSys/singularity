import type { SessionId } from '@deepseek-ai/dsh-session'

export interface GraphRecord {
  readonly id: string
  readonly name: string
  readonly envId: string
  readonly rootSessionId: SessionId
  readonly graphStoreId: string
  readonly layoutStoreId: string
  readonly createdAt: number
  readonly ready: boolean
}

export interface GraphArchive {
  readonly graph: GraphRecord
  readonly agentIds: readonly SessionId[]
  readonly archivedAt: number
}

export interface GraphsSnapshot {
  readonly version: 1
  readonly graphs: readonly GraphRecord[]
  readonly selectedId?: string
  readonly archives: readonly GraphArchive[]
}

export type GraphsEvent =
  | { readonly kind: 'graph/add'; readonly graph: GraphRecord }
  | { readonly kind: 'graph/select'; readonly id: string }
  | { readonly kind: 'graph/ready'; readonly id: string }
  | { readonly kind: 'graph/remove'; readonly id: string; readonly archive: GraphArchive }

export interface CreateGraphRequest {
  readonly name?: string
  readonly createEnv?: true
  readonly envId?: string
  /** Planned github owner/repo refs when createEnv is set. Cloned later by env agents. */
  readonly repos?: readonly string[]
}
