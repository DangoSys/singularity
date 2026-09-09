import type { Position } from '@xyflow/react'
import type { FlowNode } from '../store'

interface Pt { x: number; y: number }

const BENDS = [0, 0.18, -0.18, 0.36, -0.36, 0.55, -0.55]
const SAMPLES = 22
const MARGIN = 10

function controlFor(pos: Position | undefined, x: number, y: number, ox: number, oy: number): Pt {
  switch (pos) {
    case 'left': return { x: x - ox, y }
    case 'right': return { x: x + ox, y }
    case 'top': return { x, y: y - oy }
    default: return { x, y: y + oy }
  }
}

function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

export interface RoutedPath {
  path: string
  labelX: number
  labelY: number
}

export function routeEdge(
  sourceX: number, sourceY: number, sourcePosition: Position | undefined,
  targetX: number, targetY: number, targetPosition: Position | undefined,
  sourceId: string, targetId: string,
  nodes: FlowNode[],
): RoutedPath {
  if (sourcePosition === 'right' && targetPosition === 'left') {
    const src = nodes.find((n) => n.id === sourceId)
    const tgt = nodes.find((n) => n.id === targetId)
    if (src === undefined || tgt === undefined) throw new Error('routeEdge: endpoints missing')
    const sCx = src.position.x + src.data.width / 2
    const tCx = tgt.position.x + tgt.data.width / 2
    if (tCx < sCx) {
      sourceX = 2 * sCx - sourceX
      targetX = 2 * tCx - targetX
      sourcePosition = 'left'
      targetPosition = 'right'
    }
  }
  const p0: Pt = { x: sourceX, y: sourceY }
  const p3: Pt = { x: targetX, y: targetY }
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY)
  const offset = Math.min(Math.max(dist * 0.45, 40), 260)

  const obstacles = nodes
    .filter((n) => n.id !== sourceId && n.id !== targetId)
    .map((n) => ({
      x1: n.position.x - MARGIN,
      y1: n.position.y - MARGIN,
      x2: n.position.x + n.data.width + MARGIN,
      y2: n.position.y + n.data.height + MARGIN,
    }))

  const nx = dist > 0 ? -(targetY - sourceY) / dist : 0
  const ny = dist > 0 ? (targetX - sourceX) / dist : 0

  let best: { c1: Pt; c2: Pt; hits: number } | null = null

  for (const bend of BENDS) {
    const sway = bend * dist
    const c1 = controlFor(sourcePosition, sourceX, sourceY, offset, offset)
    const c2 = controlFor(targetPosition, targetX, targetY, offset, offset)
    c1.x += nx * sway; c1.y += ny * sway
    c2.x += nx * sway; c2.y += ny * sway

    let hits = 0
    for (let i = 1; i < SAMPLES; i++) {
      const pt = cubicAt(p0, c1, c2, p3, i / SAMPLES)
      for (const o of obstacles) {
        if (pt.x > o.x1 && pt.x < o.x2 && pt.y > o.y1 && pt.y < o.y2) { hits++; break }
      }
    }
    if (hits === 0) { best = { c1, c2, hits }; break }
    if (best === null || hits < best.hits) best = { c1, c2, hits }
  }

  if (best === null) throw new Error('routeEdge: no candidate')
  const { c1, c2 } = best
  const mid = cubicAt(p0, c1, c2, p3, 0.5)
  return {
    path: `M ${sourceX} ${sourceY} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${targetX} ${targetY}`,
    labelX: mid.x,
    labelY: mid.y,
  }
}
