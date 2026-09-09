import { useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type NodeTypes,
  type EdgeTypes,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import AgentNode from './components/AgentNode'
import AgentEdge from './components/AgentEdge'
import FocusPanel from './components/FocusPanel'
import { ZoomTierTag } from './components/ZoomTierTag'
import { pathIds, useStore } from './store'

const nodeTypes = { agent: AgentNode } as NodeTypes
const edgeTypes = { agent: AgentEdge } as EdgeTypes

function Canvas() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const paper = useStore((s) => s.paper)
  const selectedId = useStore((s) => s.selectedId)
  const error = useStore((s) => s.error)
  const setSelected = useStore((s) => s.setSelected)
  const setPaper = useStore((s) => s.setPaper)
  const moveNode = useStore((s) => s.moveNode)
  const boot = useStore((s) => s.boot)
  const graph = useStore((s) => s.graph)
  const empty = useStore((s) => s.empty)
  const applyChat = useStore((s) => s.applyChat)

  useEffect(() => {
    void boot()
  }, [boot])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'singularity:reload') void useStore.getState().boot()
      if (data.type === 'singularity:select' && typeof data.sessionId === 'string') {
        useStore.getState().setSelectedLocal(data.sessionId)
      }
      if (data.type === 'singularity:transcript') {
        if (typeof data.sessionId !== 'string') throw new Error('map: transcript missing sessionId')
        if (!Array.isArray(data.rows)) throw new Error('map: transcript missing rows')
        applyChat(data.sessionId, data.rows)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [applyChat])

  const displayNodes = useMemo(() => {
    const path = pathIds(selectedId, edges)
    return nodes.map((n) => ({
      ...n,
      className: selectedId !== null && !path.has(n.id) ? 'sg-dim' : undefined,
    }))
  }, [nodes, edges, selectedId])

  const onNodeDragStop: OnNodeDrag = (_e, node) => {
    void moveNode(node.id, node.position.x, node.position.y)
  }

  if (error !== null) {
    return <div className="sg-boot">{error}</div>
  }
  if (empty) {
    return <div className="sg-boot">Select or create a graph</div>
  }
  if (graph === null) {
    return <div className="sg-boot">Loading singularity map…</div>
  }

  return (
    <div className="sg-shell">
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.04}
        maxZoom={2}
        onlyRenderVisibleElements
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        zoomOnDoubleClick={false}
        snapToGrid={paper === 'grid'}
        snapGrid={[24, 24]}
        onNodeClick={(_e, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        onNodeDragStop={onNodeDragStop}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background
          id="grid"
          variant={paper === 'grid' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={paper === 'grid' ? 24 : 18}
          color={paper === 'grid' ? 'var(--canvas-grid-fine)' : 'var(--canvas-dot)'}
        />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
        <ZoomTierTag />
      </ReactFlow>
      <div className="sg-toolbar" role="toolbar">
        <button type="button" onClick={() => setPaper(paper === 'grid' ? 'plain' : 'grid')}>
          {paper === 'grid' ? 'Grid' : 'Paper'}
        </button>
      </div>
      <FocusPanel />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
