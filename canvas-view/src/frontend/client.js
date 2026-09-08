window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity-canvas-view',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const h = React.createElement
    const GRAPH = '/singularity/graph'
    const LAYOUT = '/singularity/layout'
    const EVENTS = '/singularity/events'
    const STYLE_ID = 'dsh-canvas-style'
    const CSS = `
.canvas-root{--singularity-bg:var(--dsh-color-background,var(--color-background,#f8fafc));--singularity-surface:var(--dsh-color-surface,var(--color-surface,#fff));--singularity-surface-muted:var(--dsh-color-surface-muted,var(--color-surface-muted,#f1f5f9));--singularity-border:var(--dsh-color-border,var(--color-border,#dbe3ee));--singularity-text:var(--dsh-color-text,var(--color-text,#1f2937));--singularity-muted:var(--dsh-color-muted,var(--color-muted,#64748b));--singularity-blue:#3b82f6;--singularity-green:#10b981;position:relative;display:flex;flex:1;min-height:0;overflow:hidden;background:var(--singularity-bg);color:var(--singularity-text);font:12px Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:light dark}
.canvas-surface{position:relative;flex:1;min-height:0;overflow:auto;background:var(--singularity-bg)}.canvas-plane{position:relative;background:var(--singularity-bg)}.canvas-layer{position:absolute;inset:0}.canvas-groups{z-index:1}.canvas-edges{z-index:1;pointer-events:none}.canvas-nodes{z-index:2}.canvas-connection-overlay{z-index:5;pointer-events:none}.canvas-origin{position:absolute;z-index:3;width:320px;height:320px;transform:translate(-50%,-50%);pointer-events:none}.canvas-orbit{position:absolute;inset:50%;transform:translate(-50%,-50%);border:1px dashed color-mix(in srgb,var(--singularity-border) 72%,transparent);border-radius:50%}.canvas-orbit-outer{width:320px;height:320px}.canvas-orbit-mid{width:208px;height:208px}.canvas-orbit-inner{width:144px;height:144px;border-color:color-mix(in srgb,var(--singularity-blue) 24%,var(--singularity-border))}.canvas-core{position:absolute;left:50%;top:50%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:50%;background:color-mix(in srgb,var(--singularity-blue) 13%,var(--singularity-surface));box-shadow:0 0 0 16px color-mix(in srgb,var(--singularity-blue) 8%,var(--singularity-surface)),0 0 0 32px color-mix(in srgb,var(--singularity-blue) 4%,var(--singularity-bg)),0 0 36px color-mix(in srgb,var(--singularity-blue) 36%,transparent)}.canvas-core:before{content:"";position:absolute;inset:16px;border-radius:50%;background:color-mix(in srgb,var(--singularity-blue) 36%,var(--singularity-surface))}.canvas-core:after{content:"";position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 0 10px 3px color-mix(in srgb,var(--singularity-blue) 72%,transparent)}.canvas-note{position:absolute;z-index:4;left:19px;bottom:16px;color:var(--singularity-muted);font-size:11px}.canvas-status{position:absolute;z-index:4;left:24px;top:24px;color:var(--singularity-muted);font-weight:600}
:root[data-theme="dark"] .canvas-root,:root[data-color-scheme="dark"] .canvas-root,[data-theme="dark"] .canvas-root,[data-color-scheme="dark"] .canvas-root{--singularity-bg:#11151c;--singularity-surface:#1a202b;--singularity-surface-muted:#202938;--singularity-border:#334155;--singularity-text:#e5e7eb;--singularity-muted:#94a3b8}@media(prefers-color-scheme:dark){.canvas-root{--singularity-bg:#11151c;--singularity-surface:#1a202b;--singularity-surface-muted:#202938;--singularity-border:#334155;--singularity-text:#e5e7eb;--singularity-muted:#94a3b8}}
`
    const state = { snapshot: null, nodes: null, error: '', source: null, root: null, surface: null, plane: null, generation: 0, origin: null, extent: { width: 0, height: 0 } }
    const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }))
    const text = value => document.createTextNode(String(value))
    const node = (tag, props = {}, ...children) => { const item = document.createElement(tag); for (const [key, value] of Object.entries(props)) item[key === 'className' ? 'className' : key] = value; for (const child of children) if (child) item.append(child); return item }

    function validate(value) {
      if (!value || typeof value !== "object" || value.version !== 1 || typeof value.id !== "string" || !Array.isArray(value.roots) || !Array.isArray(value.agents) || !Array.isArray(value.groups) || !Array.isArray(value.edges)) throw new Error("canvas: graph snapshot is invalid")
      for (const agent of value.agents) if (!agent || typeof agent.id !== "string" || typeof agent.name !== "string" || typeof agent.status !== "string") throw new Error("canvas: agent is invalid")
      return value
    }
    function validateLayout(value) {
      if (!value || typeof value !== "object" || value.version !== 1 || typeof value.id !== "string" || typeof value.nodes !== "object" || value.nodes === null) throw new Error("canvas: layout snapshot is invalid")
      return value.nodes
    }
    function detail() {
      const width = state.plane?.clientWidth || state.surface?.clientWidth || 1; const height = state.plane?.clientHeight || state.surface?.clientHeight || 1
      return { snapshot: state.snapshot, nodes: state.nodes, plane: state.plane, origin: { x: width / 2, y: height / 2 }, offsetX: 0, offsetY: 0 }
    }
    function render() {
      if (!state.plane || !state.surface || !state.origin) return
      state.plane.style.width = String(Math.max(state.surface.clientWidth, 640) + state.extent.width) + "px"; state.plane.style.height = String(Math.max(state.surface.clientHeight, 480) + state.extent.height) + "px"
      const width = state.plane.clientWidth || parseFloat(state.plane.style.width); const height = state.plane.clientHeight || parseFloat(state.plane.style.height)
      state.origin.style.left = String(width / 2) + "px"; state.origin.style.top = String(height / 2) + "px"
      state.plane.querySelectorAll(".canvas-status").forEach(item => item.remove())
      if (!state.snapshot || !state.nodes) { state.plane.append(node("div", { className: "canvas-status" }, text(state.error || "Loading graph…"))); return }
      const note = state.plane.querySelector(".canvas-note"); if (note) note.textContent = state.snapshot.agents.length === 0 ? "Empty session — only the origin exists" : "Session grown — graph radiates from the origin"
      emit("canvas:graph", detail())
    }
    async function load(generation) {
      const [graphRes, layoutRes] = await Promise.all([fetch(GRAPH), fetch(LAYOUT)])
      const graphRaw = await graphRes.text()
      const layoutRaw = await layoutRes.text()
      if (!graphRes.ok) throw new Error(graphRaw)
      if (!layoutRes.ok) throw new Error(layoutRaw)
      if (generation !== state.generation) return
      state.snapshot = validate(JSON.parse(graphRaw))
      state.nodes = validateLayout(JSON.parse(layoutRaw))
      state.error = ''; render(); emit('canvas:open', detail())
    }
    function connect(generation) {
      state.source = new EventSource(EVENTS)
      state.source.addEventListener('graph', event => { if (generation !== state.generation) return; state.snapshot = validate(JSON.parse(event.data)); state.error = ''; render() })
      state.source.addEventListener('layout', event => { if (generation !== state.generation) return; state.nodes = validateLayout(JSON.parse(event.data)); state.error = ''; render() })
      state.source.onerror = () => { if (generation !== state.generation) return; state.source?.close(); state.source = null; state.error = 'canvas: event stream closed'; render() }
      state.source.addEventListener('pr-chat/path', event => { if (generation !== state.generation) return; emit('singularity:pr-chat/path', JSON.parse(event.data)) })
      state.source.addEventListener('pr-chat/sent', event => { if (generation !== state.generation) return; emit('singularity:pr-chat/sent', JSON.parse(event.data)) })
    }
    function expand(event) {
      const direction = event.detail?.direction
      if (!state.plane || !['left', 'right', 'up', 'down'].includes(direction)) throw new Error('canvas: expansion direction is required')
      if (direction === 'left' || direction === 'right') state.extent.width += 600
      if (direction === 'up' || direction === 'down') state.extent.height += 500
      render()
    }
    function mount(root) {
      state.generation += 1; const generation = state.generation; state.extent = { width: 0, height: 0 }
      state.root = root; state.surface = node("div", { className: "canvas-surface" }); state.plane = node("div", { className: "canvas-plane" })
      state.origin = node("div", { className: "canvas-origin", "aria-label": "Session origin" }, node("div", { className: "canvas-orbit canvas-orbit-outer" }), node("div", { className: "canvas-orbit canvas-orbit-mid" }), node("div", { className: "canvas-orbit canvas-orbit-inner" }), node("div", { className: "canvas-core" }))
      state.plane.append(state.origin, node("div", { className: "canvas-layer canvas-groups" }), node("svg", { className: "canvas-layer canvas-edges", width: "100%", height: "100%" }), node("div", { className: "canvas-layer canvas-nodes" }), node("div", { className: "canvas-note" }))
      state.surface.append(state.plane); root.append(state.surface); render(); load(generation).then(() => { if (generation === state.generation) connect(generation) }).catch(error => { if (generation !== state.generation) return; state.error = error instanceof Error ? error.message : String(error); render() })
    }
    function unmount() {
      state.generation += 1; state.source?.close(); state.source = null; state.snapshot = null; state.nodes = null; state.error = ''; state.root?.replaceChildren()
      state.root = null; state.surface = null; state.plane = null; state.origin = null; emit("canvas:close", {})
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
        document.addEventListener('canvas:expand', expand); window.addEventListener('resize', render)
        return () => {
          document.removeEventListener('canvas:expand', expand); window.removeEventListener('resize', render)
          style.remove()
        }
      }, 'canvas: lifecycle')
      ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'singularity', order: 20, label: 'Singularity' }, CanvasView))
    }
    module.exports.apply = apply
    module.exports.inject = ['slots', 'sessions']
    return module.exports
  },
})
