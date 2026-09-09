import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useZoomTier } from '../lib/use-map-mode'
import type { AgentData } from '../types'

type AgentFlowNode = Node<AgentData, 'agent'>

const GLYPH: Record<AgentData['status'], string> = {
  idle: '·',
  running: '✦',
  waiting: '⏳',
  done: '✓',
  failed: '✕',
}

function AgentNodeView({ data, selected }: NodeProps<AgentFlowNode>) {
  const tier = useZoomTier()
  const role = data.routerFor ? 'router' : data.root ? 'root' : 'agent'
  const typeClass = data.root ? 'root-node' : data.status === 'failed' ? 'failed-node' : data.status === 'waiting' ? 'waiting-node' : ''

  if (tier === 'glyph') {
    return (
      <div
        data-glyph-node
        data-status={data.status}
        data-selected={selected}
        className={`sg-glyph-wrap${selected ? ' glyph-selected' : ''}`}
        title={`${data.name}\n${data.status}`}
      >
        <Handle type="target" id="in" position={Position.Left} className="sg-handle sg-handle-lg" />
        <span className="sg-glyph-seal" data-status={data.status}>{GLYPH[data.status]}</span>
        <Handle type="source" id="out" position={Position.Right} className="sg-handle sg-handle-lg" />
      </div>
    )
  }

  if (tier === 'map') {
    return (
      <div
        data-status={data.status}
        data-selected={selected}
        data-root={data.root}
        className={`thought-node map-node ${typeClass}`}
      >
        <Handle type="target" id="in" position={Position.Left} className="sg-handle sg-handle-lg" />
        <div className="sg-map-body">
          <div className="sg-map-eyebrow">{role}</div>
          <div className="sg-map-title">{data.name}</div>
          <div className="sg-map-status">{data.status}</div>
        </div>
        <Handle type="source" id="out" position={Position.Right} className="sg-handle sg-handle-lg" />
      </div>
    )
  }

  return (
    <div
      data-status={data.status}
      data-selected={selected}
      data-root={data.root}
      className={`thought-node ${typeClass}`}
      style={{ width: data.width, minHeight: data.height }}
    >
      <Handle type="target" id="in" position={Position.Left} className="sg-handle" />
      <div className="sg-work-head">
        <span className="sg-work-role">{role}</span>
        <span className="sg-work-status" data-status={data.status}>
          <i className="sg-dot" data-status={data.status} />
          {data.status}
        </span>
      </div>
      <div className="sg-work-body">
        <div className="sg-work-title">{data.name}</div>
      </div>
      <Handle type="source" id="out" position={Position.Right} className="sg-handle" />
    </div>
  )
}

export default memo(AgentNodeView)
