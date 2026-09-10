import type { GraphSnapshot, LayoutSnapshot, CanvasNode } from './types'
import type { ChatRow, GraphMeta, HitlPending } from './store'

const GRAPH = '/singularity/graph'
const LAYOUT = '/singularity/layout'
const EVENTS = '/singularity/events'
const GRAPHS = '/singularity/graphs'
const HITL = '/singularity/hitl'

function check(res: Response, body: string): void {
  if (!res.ok) throw new Error(`${res.url}: ${res.status} ${body}`)
}

export async function fetchGraph(): Promise<GraphSnapshot> {
  const res = await fetch(GRAPH)
  const text = await res.text()
  if (res.status === 409) throw new Error(text)
  check(res, text)
  const value = JSON.parse(text) as GraphSnapshot
  if (value.version !== 1) throw new Error('graph: unexpected version')
  return value
}

export async function fetchLayout(): Promise<LayoutSnapshot> {
  const res = await fetch(LAYOUT)
  const text = await res.text()
  if (res.status === 409) throw new Error(text)
  check(res, text)
  const value = JSON.parse(text) as LayoutSnapshot
  if (value.version !== 1) throw new Error('layout: unexpected version')
  return value
}

export async function fetchGraphs(): Promise<{ graphs: GraphMeta[]; selectedId?: string }> {
  const res = await fetch(GRAPHS)
  const text = await res.text()
  check(res, text)
  const value = JSON.parse(text) as { version: 1; graphs: GraphMeta[]; selectedId?: string }
  if (value.version !== 1) throw new Error('graphs: unexpected version')
  return value
}

export async function fetchHitl(): Promise<{ pending: HitlPending[] }> {
  const res = await fetch(HITL)
  const text = await res.text()
  check(res, text)
  return JSON.parse(text) as { pending: HitlPending[] }
}

export async function answerHitl(
  id: string,
  answer: { kind: 'ask'; text: string } | { kind: 'approve'; decision: 'approve' | 'reject' },
): Promise<{ pending: HitlPending[] }> {
  const res = await fetch(HITL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, answer }),
  })
  const text = await res.text()
  check(res, text)
  return JSON.parse(text) as { pending: HitlPending[] }
}

export async function putLayout(sessionId: string, node: CanvasNode): Promise<LayoutSnapshot> {
  const res = await fetch(LAYOUT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, node }),
  })
  const text = await res.text()
  check(res, text)
  return JSON.parse(text) as LayoutSnapshot
}

export function openEvents(handlers: {
  onGraph: (g: GraphSnapshot) => void
  onLayout: (l: LayoutSnapshot) => void
  onGraphs: (snap: { graphs: GraphMeta[]; selectedId?: string }) => void
  onHitl: (pending: HitlPending[]) => void
  onError: () => void
}): EventSource {
  const source = new EventSource(EVENTS)
  source.addEventListener('graph', (event) => {
    handlers.onGraph(JSON.parse((event as MessageEvent).data) as GraphSnapshot)
  })
  source.addEventListener('layout', (event) => {
    handlers.onLayout(JSON.parse((event as MessageEvent).data) as LayoutSnapshot)
  })
  source.addEventListener('graphs', (event) => {
    handlers.onGraphs(JSON.parse((event as MessageEvent).data) as { graphs: GraphMeta[]; selectedId?: string })
  })
  source.addEventListener('hitl', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { pending: HitlPending[] }
    handlers.onHitl(data.pending)
  })
  source.onerror = () => {
    if (source.readyState !== EventSource.CLOSED) return
    handlers.onError()
  }
  return source
}
