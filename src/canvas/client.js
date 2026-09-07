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
.canvas-root{--canvas-ink:#0d151b;--canvas-text:#e8f0ed;position:relative;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;background:var(--canvas-ink);color:var(--canvas-text);font:13px ui-sans-serif,system-ui,sans-serif;color-scheme:dark;isolation:isolate}
.canvas-root:before{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at 8% 0%,#24433855,transparent 38%),radial-gradient(circle at 92% 100%,#24363d55,transparent 34%);content:""}
.canvas-toolbar{position:relative;z-index:3;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;flex:none;height:68px;padding:0 22px;border-bottom:1px solid #30434c;background:#101a20dd;backdrop-filter:blur(18px)}.canvas-brand{display:flex;align-items:center;gap:11px}.canvas-brand-mark{display:grid;place-items:center;width:30px;height:30px;border:1px solid #8de4ba66;border-radius:9px;background:linear-gradient(145deg,#274b3e,#172921);box-shadow:0 0 0 4px #9be8c40d;color:#b8f5d2;font-size:15px;font-weight:800}.canvas-brand-copy{display:grid;gap:2px}.canvas-brand-copy strong{color:#f2f7f4;font-size:14px}.canvas-brand-copy span{color:#809899;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}.canvas-toolbar-meta{display:flex;align-items:center;gap:7px;color:#9bcdb2;font-size:10px;font-weight:700;letter-spacing:.16em}.canvas-live-dot{width:7px;height:7px;border-radius:50%;background:#83e3b2;box-shadow:0 0 0 4px #83e3b21c,0 0 16px #83e3b288}
.canvas-surface{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;background:#0d151b;scrollbar-color:#38505a transparent}.canvas-surface::-webkit-scrollbar{width:10px;height:10px}.canvas-surface::-webkit-scrollbar-thumb{border:3px solid #0d151b;border-radius:10px;background:#38505a}.canvas-plane{position:relative;background-color:#101b21;background-image:linear-gradient(#20303966 1px,transparent 1px),linear-gradient(90deg,#20303966 1px,transparent 1px),radial-gradient(circle at 50% 38%,#28403922,transparent 52%);background-size:28px 28px,28px 28px,100% 100%}.canvas-plane:after{position:absolute;z-index:0;inset:0;pointer-events:none;background:linear-gradient(90deg,#0d151b,transparent 11%,transparent 89%,#0d151b),linear-gradient(#0d151b,transparent 11%,transparent 89%,#0d151b);content:"";opacity:.55}.canvas-layer{position:absolute;z-index:1;inset:0}.canvas-status{position:absolute;z-index:4;top:22px;left:22px;display:flex;align-items:flex-start;gap:12px;box-sizing:border-box;width:min(420px,calc(100vw - 64px));padding:15px 17px;border:1px solid #46606a88;border-radius:14px;background:#17252bd9;box-shadow:0 16px 34px #050b0e66,0 1px 0 #ffffff0a inset;backdrop-filter:blur(14px);color:#b5c9c6}.canvas-status-mark{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:9px;background:#234436;color:#9be8c4;font-size:13px;font-weight:800}.canvas-status-copy{display:grid;gap:4px;min-width:0}.canvas-status-copy strong{color:#edf7f2;font-size:13px}.canvas-status-copy span{color:#8fa5a7;font-size:12px;line-height:1.45}.canvas-status.is-error{border-color:#70484299}.canvas-status.is-error .canvas-status-mark{background:#59332f;color:#ffc1a8}
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
      if (!state.snapshot) {
        const failed = Boolean(state.error)
        state.plane.append(node('div', { className: `canvas-status${failed ? ' is-error' : ''}` }, node('div', { className: 'canvas-status-mark' }, text(failed ? '!' : '…')), node('div', { className: 'canvas-status-copy' }, node('strong', {}, text(failed ? 'Graph unavailable' : 'Preparing workspace')), node('span', {}, text(state.error || 'Syncing agent topology…')))))
        return
      }
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
      state.surface.append(state.plane)
      const toolbar = node('div', { className: 'canvas-toolbar' }, node('div', { className: 'canvas-brand' }, node('span', { className: 'canvas-brand-mark' }, text('∴')), node('span', { className: 'canvas-brand-copy' }, node('strong', {}, text('Singularity')), node('span', {}, text('Agent topology')))), node('div', { className: 'canvas-toolbar-meta' }, node('span', { className: 'canvas-live-dot' }), text('Live graph')))
      root.append(toolbar, state.surface); render(); load(generation).then(() => { if (generation === state.generation) connect(generation) }).catch(error => { if (generation !== state.generation) return; state.error = error instanceof Error ? error.message : String(error); render() })
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
