import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { AgentData, CanvasNode, GraphSnapshot, LayoutSnapshot } from './types'
import { answerHitl, fetchGraph, fetchGraphs, fetchHitl, fetchLayout, openEvents, putLayout } from './api'

export type FlowNode = Node<AgentData>
export type FlowEdge = Edge<{ kind: 'spawn' | 'handoff'; brief?: string }>

export interface GraphMeta {
  readonly id: string
  readonly name: string
  readonly ready: boolean
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
  chat: { sessionId: string | null; rows: ChatRow[] }
  hitl: HitlPending[]
  boot: () => Promise<void>
  applyGraph: (g: GraphSnapshot) => void
  applyLayout: (l: LayoutSnapshot) => void
  applyGraphs: (graphs: { graphs: GraphMeta[]; selectedId?: string }) => void
  applyHitl: (pending: HitlPending[]) => void
  applyChat: (sessionId: string, rows: ChatRow[]) => void
  setSelected: (id: string | null) => void
  setSelectedLocal: (id: string) => void
  setPaper: (p: 'plain' | 'grid') => void
  moveNode: (id: string, x: number, y: number) => Promise<void>
  sendPrompt: (sessionId: string, text: string) => Promise<void>
  answerHitl: (id: string, answer: { kind: 'ask'; text: string } | { kind: 'approve'; decision: 'approve' | 'reject' }) => Promise<void>
}

function build(graph: GraphSnapshot, layout: LayoutSnapshot, selectedId: string | null): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const roots = new Set(graph.roots)
  const nodes: FlowNode[] = graph.agents.map((agent) => {
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
  const edges: FlowEdge[] = graph.edges.map((edge) => ({
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
  chat: { sessionId: null, rows: [] },
  hitl: [],
  async boot() {
    get().source?.close()
    try {
      const [graph, layout, graphsSnap, hitlSnap] = await Promise.all([
        fetchGraph(),
        fetchLayout(),
        fetchGraphs(),
        fetchHitl(),
      ])
      const selected = graphsSnap.graphs.find((g) => g.id === graphsSnap.selectedId)
      if (selected === undefined) throw new Error('map: selected graph missing from registry')
      const selectedId = get().selectedId ?? selected.rootSessionId
      const { nodes, edges } = build(graph, layout, selectedId)
      const source = openEvents({
        onGraph: (g) => get().applyGraph(g),
        onLayout: (l) => get().applyLayout(l),
        onGraphs: (snap) => get().applyGraphs(snap),
        onHitl: (pending) => get().applyHitl(pending),
        onError: () => set({ error: 'singularity: event stream closed' }),
      })
      set({
        graph,
        layout,
        graphMeta: selected,
        nodes,
        edges,
        selectedId,
        hitl: hitlSnap.pending,
        error: null,
        empty: false,
        source,
      })
      window.parent.postMessage({ type: 'singularity:open', sessionId: selectedId, title: 'Singularity' }, '*')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('no graph selected')) {
        set({
          graph: null,
          layout: null,
          graphMeta: null,
          nodes: [],
          edges: [],
          empty: true,
          error: null,
          source: null,
          selectedId: null,
          chat: { sessionId: null, rows: [] },
        })
        return
      }
      throw error
    }
  },
  applyGraph(graph) {
    const layout = get().layout
    if (layout === null) throw new Error('map: layout missing while applying graph')
    const { nodes, edges } = build(graph, layout, get().selectedId)
    set({ graph, nodes, edges, empty: false })
  },
  applyLayout(layout) {
    const graph = get().graph
    if (graph === null) throw new Error('map: graph missing while applying layout')
    const { nodes, edges } = build(graph, layout, get().selectedId)
    set({ layout, nodes, edges })
  },
  applyGraphs(snap) {
    const selected = snap.graphs.find((g) => g.id === snap.selectedId)
    set({ graphMeta: selected ?? null })
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
      const agent = graph.agents.find((a) => a.id === id)
      if (agent === undefined) throw new Error(`map: selected unknown agent ${id}`)
      window.parent.postMessage({ type: 'singularity:open', sessionId: id, title: agent.name }, '*')
    }
  },
  setSelectedLocal(id) {
    const graph = get().graph
    const layout = get().layout
    if (graph === null || layout === null) return
    const { nodes, edges } = build(graph, layout, id)
    set({ selectedId: id, nodes, edges })
  },
  setPaper(paper) {
    document.documentElement.dataset.paper = paper
    set({ paper })
  },
  async moveNode(id, x, y) {
    const layout = get().layout
    if (layout === null) throw new Error('map: layout missing')
    const prev = layout.nodes[id]
    if (prev === undefined) throw new Error(`map: unknown node ${id}`)
    const node: CanvasNode = { ...prev, x, y }
    const next = await putLayout(id, node)
    get().applyLayout(next)
  },
  async sendPrompt(sessionId, text) {
    window.parent.postMessage({ type: 'singularity:prompt', sessionId, text }, '*')
  },
  async answerHitl(id, answer) {
    const next = await answerHitl(id, answer)
    set({ hitl: next.pending })
  },
}))

export function pathIds(selectedId: string | null, edges: FlowEdge[]): Set<string> {
  return ancestors(selectedId, edges)
}
