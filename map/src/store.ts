import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { AgentData, CanvasNode, GraphSnapshot, LayoutSnapshot } from './types'
import { answerHitl, fetchGraph, fetchHitl, openEvents, putLayout, GRAPH_ID, type ViewSnapshot } from './api'

export type FlowNode = Node<AgentData>
export type FlowEdge = Edge<{ kind: 'spawn' | 'handoff'; brief?: string }>

export interface GraphMeta {
  readonly id: string
  readonly name: string
  readonly ready: boolean
  readonly graphStoreId: string
  readonly layoutStoreId: string
  readonly rootSessionId: string
}

export interface ChatRow {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

export interface HitlPending {
  readonly id: string
  readonly kind: 'ask' | 'approve'
  readonly prompt: string
  readonly sessionId: string
  readonly createdAt: number
}

interface Store {
  graph: GraphSnapshot | null
  layout: LayoutSnapshot | null
  graphMeta: GraphMeta | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedId: string | null
  paper: 'plain' | 'grid'
  error: string | null
  empty: boolean
  source: EventSource | null
  generation: number
  chat: { sessionId: string | null; rows: ChatRow[] }
  hitl: HitlPending[]
  submission: { id: string; resolve: () => void; reject: (error: Error) => void } | null
  finishPrompt: (id: string, error?: string) => void
  boot: () => Promise<void>
  applySnapshot: (view: ViewSnapshot) => void
  applyHitl: (pending: HitlPending[]) => void
  applyChat: (sessionId: string, rows: ChatRow[]) => void
  setSelected: (id: string | null) => void
  setPaper: (p: 'plain' | 'grid') => void
  setNodes: (nodes: FlowNode[]) => void
  moveNode: (id: string, x: number, y: number) => Promise<void>
  sendPrompt: (sessionId: string, text: string) => Promise<void>
  answerHitl: (
    id: string,
    answer: { kind: 'ask'; text: string } | { kind: 'approve'; decision: 'approve' | 'reject' },
  ) => Promise<void>
}

function build(
  graph: GraphSnapshot,
  layout: LayoutSnapshot,
  selectedId: string | null,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const roots = new Set(graph.roots)
  const nodes: FlowNode[] = graph.agents.map(agent => {
    const geo = layout.nodes[agent.id]
    if (geo === undefined) throw new Error(`map: agent ${agent.id} has no layout`)
    return {
      id: agent.id,
      type: 'agent',
      position: { x: geo.x, y: geo.y },
      selected: agent.id === selectedId,
      data: {
        ...agent,
        width: geo.width,
        height: geo.height,
        shape: geo.shape,
        root: roots.has(agent.id),
      },
      style: { width: geo.width, height: geo.height },
    }
  })
  const edges: FlowEdge[] = graph.edges.map(edge => ({
    id: edge.id,
    type: 'agent',
    source: edge.from,
    target: edge.to,
    sourceHandle: 'out',
    targetHandle: 'in',
    data: { kind: edge.kind, brief: edge.brief },
  }))
  return { nodes, edges }
}

function ancestors(selectedId: string | null, edges: FlowEdge[]): Set<string> {
  if (selectedId === null) return new Set()
  const byTarget = new Map<string, string[]>()
  for (const e of edges) {
    const list = byTarget.get(e.target)
    if (list) list.push(e.source)
    else byTarget.set(e.target, [e.source])
  }
  const hit = new Set<string>([selectedId])
  const stack = [selectedId]
  while (stack.length > 0) {
    const id = stack.pop()!
    const parents = byTarget.get(id)
    if (parents === undefined) continue
    for (const parent of parents) {
      if (hit.has(parent)) continue
      hit.add(parent)
      stack.push(parent)
    }
  }
  return hit
}

export const useStore = create<Store>((set, get) => ({
  graph: null,
  layout: null,
  graphMeta: null,
  nodes: [],
  edges: [],
  selectedId: null,
  paper: 'grid',
  error: null,
  empty: false,
  source: null,
  generation: 0,
  chat: { sessionId: null, rows: [] },
  hitl: [],
  submission: null,
  async boot() {
    get().source?.close()
    if (GRAPH_ID === null) {
      set({ empty: true })
      return
    }
    const generation = get().generation + 1
    set({ generation, source: null })
    const [view, hitl] = await Promise.all([fetchGraph(), fetchHitl()])
    if (get().generation !== generation) return
    set({ selectedId: view.meta.rootSessionId })
    get().applySnapshot(view)
    const source = openEvents({
      onSnapshot: view => {
        if (get().generation === generation) get().applySnapshot(view)
      },
      onHitl: pending => {
        if (get().generation === generation) get().applyHitl(pending)
      },
      onError: () => {
        set({ error: 'singularity: event stream closed' })
      },
    })
    set({ hitl: hitl.pending, source })
    window.parent.postMessage(
      { type: 'singularity:open', graphId: GRAPH_ID, sessionId: view.meta.rootSessionId },
      location.origin,
    )
  },
  applySnapshot({ graph, layout, meta }) {
    if (meta.id !== GRAPH_ID) throw new Error('map: wrong graph snapshot')
    if (graph.id !== meta.graphStoreId || layout.id !== meta.layoutStoreId)
      throw new Error('map: store identity mismatch')
    const selectedId = get().selectedId
    if (selectedId !== null && !graph.agents.some(agent => agent.id === selectedId))
      throw new Error('map: selected agent missing')
    const next = build(graph, layout, selectedId)
    set({ graph, layout, graphMeta: meta, ...next, empty: false })
  },
  applyHitl(pending) {
    set({ hitl: pending })
  },
  applyChat(sessionId, rows) {
    set({ chat: { sessionId, rows } })
  },
  setSelected(id) {
    const graph = get().graph
    const layout = get().layout
    if (graph === null || layout === null) throw new Error('map: cannot select before boot')
    const { nodes, edges } = build(graph, layout, id)
    set({ selectedId: id, nodes, edges })
    if (id !== null) {
      const agent = graph.agents.find(a => a.id === id)
      if (agent === undefined) throw new Error(`map: selected unknown agent ${id}`)
      window.parent.postMessage(
        { type: 'singularity:open', graphId: GRAPH_ID, sessionId: id, title: agent.name },
        location.origin,
      )
    }
  },
  setPaper(paper) {
    document.documentElement.dataset.paper = paper
    set({ paper })
  },
  setNodes(nodes) {
    set({ nodes })
  },
  async moveNode(id, x, y) {
    const layout = get().layout
    if (layout === null) throw new Error('map: layout missing')
    const prev = layout.nodes[id]
    if (prev === undefined) throw new Error(`map: unknown node ${id}`)
    const node: CanvasNode = { ...prev, x, y }
    await putLayout(id, node)
  },
  async sendPrompt(sessionId, text) {
    if (get().submission !== null) throw new Error('map: prompt already submitting')
    const requestId = crypto.randomUUID()
    const done = new Promise<void>((resolve, reject) => set({ submission: { id: requestId, resolve, reject } }))
    window.parent.postMessage(
      { type: 'singularity:prompt', graphId: GRAPH_ID, requestId, sessionId, text },
      location.origin,
    )
    return done
  },
  finishPrompt(id, error) {
    const submission = get().submission
    if (submission === null || submission.id !== id) throw new Error('map: unexpected prompt result')
    set({ submission: null })
    if (error !== undefined) submission.reject(new Error(error))
    else submission.resolve()
  },
  async answerHitl(id, answer) {
    await answerHitl(id, answer)
  },
}))

export function pathIds(selectedId: string | null, edges: FlowEdge[]): Set<string> {
  return ancestors(selectedId, edges)
}
