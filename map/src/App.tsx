import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type OnNodeDrag,
  type OnNodesChange,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import AgentNode from './components/AgentNode'
import AgentEdge from './components/AgentEdge'
import FocusPanel from './components/FocusPanel'
import { ZoomTierTag } from './components/ZoomTierTag'
import { pathIds, useStore, type FlowNode } from './store'
import { GRAPH_ID } from './api'

const nodeTypes = { agent: AgentNode } as NodeTypes
const edgeTypes = { agent: AgentEdge } as EdgeTypes

function Canvas() {
  const nodes = useStore(s => s.nodes)
  const edges = useStore(s => s.edges)
  const paper = useStore(s => s.paper)
  const selectedId = useStore(s => s.selectedId)
  const error = useStore(s => s.error)
  const setSelected = useStore(s => s.setSelected)
  const setPaper = useStore(s => s.setPaper)
  const moveNode = useStore(s => s.moveNode)
  const setNodes = useStore(s => s.setNodes)
  const boot = useStore(s => s.boot)
  const graph = useStore(s => s.graph)
  const empty = useStore(s => s.empty)
  const applyChat = useStore(s => s.applyChat)
  const [bootError, setBootError] = useState<string | null>(null)
  const lastFittedGraphId = useRef<string | null>(null)
  const { fitView } = useReactFlow()

  useEffect(() => {
    void boot().catch(error => setBootError(error instanceof Error ? error.message : String(error)))
    return () => {
      useStore.getState().source?.close()
    }
  }, [boot])

  useEffect(() => {
    if (graph === null || nodes.length === 0 || lastFittedGraphId.current === graph.id) return
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.25, maxZoom: 1 })
      lastFittedGraphId.current = graph.id
    })
    return () => cancelAnimationFrame(frame)
  }, [fitView, graph, nodes.length])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== location.origin) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.graphId !== GRAPH_ID) return
      if (data.type === 'singularity:session-error') useStore.setState({ error: data.message })
      if (data.type === 'singularity:prompt-result') useStore.getState().finishPrompt(data.requestId, data.error)
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
    return nodes.map(n => ({
      ...n,
      className: selectedId !== null && !path.has(n.id) ? 'sg-dim' : undefined,
    }))
  }, [nodes, edges, selectedId])

  const onNodeDragStop: OnNodeDrag = (_e, node) => {
    void moveNode(node.id, node.position.x, node.position.y).catch(error => {
      useStore.setState({ error: error instanceof Error ? error.message : String(error) })
    })
  }

  const onNodesChange: OnNodesChange<FlowNode> = changes => {
    setNodes(applyNodeChanges(changes, useStore.getState().nodes))
  }

  if (bootError !== null) {
    return <div className="sg-boot">{bootError}</div>
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
        nodesConnectable={false}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        snapToGrid={paper === 'grid'}
        snapGrid={[24, 24]}
        onNodeClick={(_e, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        onNodeDragStop={onNodeDragStop}
        onNodesChange={onNodesChange}
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
      <FocusPanel key={selectedId} />
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
