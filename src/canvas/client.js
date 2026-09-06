window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/canvas',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const h = React.createElement
    const GRAPH = '/singular/graph'
    const EVENTS = '/singular/events'
    const STYLE_ID = 'dsh-canvas-style'
    const CSS = `
.canvas-root{position:relative;display:flex;flex:1;min-height:0;overflow:hidden;background:#e8edf3;color:#172033;font:13px system-ui,sans-serif;color-scheme:light}
.canvas-surface{position:relative;flex:1;min-height:0;overflow:auto;background:#e8edf3}
.canvas-plane{position:relative;background:#f7f9fb;background-image:linear-gradient(#dfe5ed 1px,transparent 1px),linear-gradient(90deg,#dfe5ed 1px,transparent 1px);background-size:24px 24px}
.canvas-layer{position:absolute;inset:0}.canvas-status{padding:24px;color:#40506a;font-weight:600}
`
    const state = { snapshot: null, error: '', source: null, root: null, surface: null, plane: null, generation: 0, extent: { left: 360, top: 240, right: 1800, bottom: 1100 } }
    const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }))
    const text = value => document.createTextNode(String(value))
    const node = (tag, props = {}, ...children) => { const item = document.createElement(tag); for (const [key, value] of Object.entries(props)) item[key === 'className' ? 'className' : key] = value; for (const child of children) if (child) item.append(child); return item }

    function validate(value) {
      if (!value || typeof value !== 'object' || value.version !== 1 || typeof value.id !== 'string'
        || !Array.isArray(value.roots) || !Array.isArray(value.agents) || !Array.isArray(value.groups)
        || !Array.isArray(value.edges)) throw new Error('canvas: graph snapshot is invalid')
      for (const agent of value.agents) {
        const box = agent.node
        if (!agent || typeof agent.id !== 'string' || typeof agent.name !== 'string'
          || typeof agent.status !== 'string' || !box || !Number.isFinite(box.x) || !Number.isFinite(box.y)
          || !Number.isFinite(box.width) || box.width <= 0 || !Number.isFinite(box.height) || box.height <= 0
          || !['card', 'circle', 'diamond'].includes(box.shape)) {
          throw new Error(`canvas: agent "${agent?.id}" has no valid node geometry`)
        }
      }
      return value
    }
    function detail() { return { snapshot: state.snapshot, plane: state.plane, offsetX: state.extent.left, offsetY: state.extent.top } }
    function render() {
      if (!state.plane) return
      const width = state.extent.left + state.extent.right
      const height = state.extent.top + state.extent.bottom
      state.plane.style.width = `${width}px`; state.plane.style.height = `${height}px`
      state.plane.querySelectorAll('.canvas-layer').forEach(layer => { layer.style.transform = `translate(${state.extent.left}px,${state.extent.top}px)` })
      state.plane.querySelectorAll('.canvas-status').forEach(item => item.remove())
      if (!state.snapshot) { state.plane.append(node('div', { className: 'canvas-status' }, text(state.error || 'Loading graph...'))); return }
      emit('canvas:graph', detail())
    }
    async function load(generation) {
      const response = await fetch(GRAPH); const raw = await response.text()
      if (!response.ok) throw new Error(raw)
      if (generation !== state.generation) return
      state.snapshot = validate(JSON.parse(raw)); state.error = ''; render(); emit('canvas:open', detail())
    }
    function connect(generation) {
      state.source = new EventSource(EVENTS)
      state.source.addEventListener('graph', event => { if (generation !== state.generation) return; state.snapshot = validate(JSON.parse(event.data)); state.error = ''; render() })
      state.source.onerror = () => { if (generation !== state.generation) return; state.source?.close(); state.source = null; state.error = 'canvas: event stream closed'; render() }
    }
    function expand(event) {
      const direction = event.detail?.direction
      if (!state.plane || !['left', 'right', 'up', 'down'].includes(direction)) throw new Error('canvas: expansion direction is required')
      if (direction === 'left') state.extent.left += 600
      if (direction === 'right') state.extent.right += 600
      if (direction === 'up') state.extent.top += 500
      if (direction === 'down') state.extent.bottom += 500
      render()
    }
    function mount(root) {
      state.generation += 1; const generation = state.generation
      state.root = root; state.surface = node('div', { className: 'canvas-surface' }); state.plane = node('div', { className: 'canvas-plane' })
      state.plane.append(node('div', { className: 'canvas-layer canvas-groups' }), node('svg', { className: 'canvas-layer canvas-edges', width: '100%', height: '100%' }), node('div', { className: 'canvas-layer canvas-nodes' }))
      state.surface.append(state.plane); root.append(state.surface); render(); load(generation).then(() => { if (generation === state.generation) connect(generation) }).catch(error => { if (generation !== state.generation) return; state.error = error instanceof Error ? error.message : String(error); render() })
    }
    function unmount() {
      state.generation += 1; state.source?.close(); state.source = null; state.snapshot = null; state.error = ''; state.root?.replaceChildren()
      state.root = null; state.surface = null; state.plane = null; emit('canvas:close', {})
    }
    function CanvasView() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        if (!ref.current) throw new Error('canvas: view root is not mounted')
        mount(ref.current)
        return unmount
      }, [])
      return h('div', { id: 'canvas-root', className: 'canvas-root', ref })
    }
    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style)
        const pending = new Set()
        const selectPresetView = () => {
          const sessionId = ctx.sessions.list.getSnapshot().current
          if (sessionId === undefined || !pending.has(sessionId)) return
          const tab = [...document.querySelectorAll('[role="tab"]')].find(item => item.textContent?.trim() === 'Singularity')
          if (!tab) return
          pending.delete(sessionId)
          tab.click()
        }
        const onPreset = (sessionId, preset) => {
          if (preset !== 'singularity') return
          pending.add(sessionId)
          selectPresetView()
        }
        const observer = new MutationObserver(selectPresetView)
        observer.observe(document.body, { childList: true, subtree: true })
        document.addEventListener('canvas:expand', expand)
        const disposePreset = ctx.remote.$on('agent-preset/selected', onPreset)
        return () => {
          document.removeEventListener('canvas:expand', expand)
          disposePreset()
          observer.disconnect()
          pending.clear()
          style.remove()
        }
      }, 'canvas: lifecycle')
      ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'singularity', order: 20, label: 'Singularity' }, CanvasView))
    }
    module.exports.apply = apply
    module.exports.inject = ['slots', 'sessions', 'remote']
    return module.exports
  },
})
