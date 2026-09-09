import { useMemo } from 'react'
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'
import { routeEdge } from '../lib/edge-path'
import { pathIds, useStore, type FlowEdge } from '../store'

export default function AgentEdgeView({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  selected, interactionWidth, data,
}: EdgeProps<FlowEdge>) {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const selectedId = useStore((s) => s.selectedId)

  const routed = useMemo(
    () => routeEdge(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target, nodes),
    [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, source, target, nodes],
  )

  const kind = data?.kind
  if (kind !== 'spawn' && kind !== 'handoff') throw new Error(`edge ${id}: kind required`)

  const pathSet = pathIds(selectedId, edges)
  const highlighted = selectedId !== null && pathSet.has(source) && pathSet.has(target)

  const stroke = highlighted || selected ? 'var(--color-trace)' : 'var(--color-accent)'
  const dash = kind === 'handoff' ? '8 4' : undefined
  const width = selected || highlighted ? 2.5 : 1.6
  const opacity = selectedId !== null && !highlighted && !selected ? 0.22 : 1

  return (
    <>
      <BaseEdge
        path={routed.path}
        style={{ stroke, strokeWidth: width, strokeDasharray: dash, opacity }}
        interactionWidth={interactionWidth}
      />
      {highlighted && <path d={routed.path} className="sg-flow-ov" fill="none" />}
      {data.brief !== undefined && data.brief.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan sg-edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${routed.labelX}px, ${routed.labelY}px)` }}
          >
            {data.brief}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
