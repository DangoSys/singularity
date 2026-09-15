import type { GraphSnapshot, LayoutSnapshot, CanvasNode } from './types'
import type { GraphMeta, HitlPending } from './store'

export const GRAPH_ID = new URLSearchParams(window.location.search).get('graphId')
const query = '?graphId=' + encodeURIComponent(GRAPH_ID ?? '')
const GRAPH = '/singularity/graph' + query
const LAYOUT = '/singularity/layout' + query
const EVENTS = '/singularity/events' + query
const HITL = '/singularity/hitl'

function check(res: Response, body: string): void {
  if (!res.ok) throw new Error(`${res.url}: ${res.status} ${body}`)
}

export interface ViewSnapshot {
  meta: GraphMeta
  graph: GraphSnapshot
  layout: LayoutSnapshot
}

export async function fetchGraph(): Promise<ViewSnapshot> {
  const res = await fetch(GRAPH)
  const text = await res.text()
  check(res, text)
  return JSON.parse(text) as ViewSnapshot
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
  onSnapshot: (view: ViewSnapshot) => void
  onHitl: (pending: HitlPending[]) => void
  onError: () => void
}): EventSource {
  const source = new EventSource(EVENTS)
  source.addEventListener('snapshot', event => {
    handlers.onSnapshot(JSON.parse((event as MessageEvent).data) as ViewSnapshot)
  })
  source.addEventListener('hitl', event => {
    const data = JSON.parse((event as MessageEvent).data) as { pending: HitlPending[] }
    handlers.onHitl(data.pending)
  })
  source.onerror = () => {
    if (source.readyState !== EventSource.CLOSED) return
    handlers.onError()
  }
  return source
}
