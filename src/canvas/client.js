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
.canvas-root{position:relative;display:flex;flex:1;min-height:0;overflow:hidden;background:#07080a;color:#d9dde5;font:12px Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:dark}
.canvas-surface{position:relative;flex:1;min-height:0;overflow:auto;background:#07080a}.canvas-plane{position:relative;background:radial-gradient(ellipse 58% 62% at 50% 50%,#12243a 0%,#0e1a2a 28%,#0a1019 52%,rgba(7,8,10,0) 76%),#07080a}.canvas-plane:before{content:"";position:absolute;z-index:0;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(77,163,255,.14),rgba(24,54,88,.08) 31%,rgba(7,8,10,0) 65%)}.canvas-layer{position:absolute;inset:0}.canvas-groups{z-index:1}.canvas-edges{z-index:1;pointer-events:none}.canvas-nodes{z-index:2}.canvas-origin{position:absolute;z-index:3;width:320px;height:320px;transform:translate(-50%,-50%);pointer-events:none}.canvas-orbit{position:absolute;inset:50%;transform:translate(-50%,-50%);border:1px dashed #171c22;border-radius:50%}.canvas-orbit-outer{width:320px;height:320px;border-color:#101419}.canvas-orbit-mid{width:208px;height:208px}.canvas-orbit-inner{width:144px;height:144px;border-color:#1d2732}.canvas-core{position:absolute;left:50%;top:50%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:50%;background:#111c2a;box-shadow:0 0 0 16px #111c2a,0 0 0 32px #0d1723,0 0 36px rgba(77,163,255,.42),0 0 72px rgba(43,93,155,.22)}.canvas-core:before{content:"";position:absolute;inset:16px;border-radius:50%;background:#24466e;box-shadow:inset 0 0 12px rgba(77,163,255,.35)}.canvas-core:after{content:"";position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:#f5f8ff;box-shadow:0 0 10px 3px #8ec4ff}.canvas-live{position:absolute;z-index:4;left:19px;top:16px;width:48px;height:80px;display:flex;align-items:center;justify-content:center;border:1px solid #242728;border-radius:24px;background:#101215;color:#d9dde5}.canvas-live span{display:flex;align-items:center;gap:6px}.canvas-live i{width:6px;height:6px;border-radius:50%;background:#3dff8a;box-shadow:0 0 8px rgba(61,255,138,.6)}.canvas-note{position:absolute;z-index:4;left:19px;bottom:16px;color:#626b79;font-size:11px}.canvas-status{position:absolute;z-index:4;left:24px;top:24px;color:#8f99a8;font-weight:600}
`
    const state = { snapshot: null, error: '', source: null, root: null, surface: null, plane: null, generation: 0, origin: null, extent: { width: 0, height: 0 } }
    const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }))
    const text = value => document.createTextNode(String(value))
    const node = (tag, props = {}, ...children) => { const item = document.createElement(tag); for (const [key, value] of Object.entries(props)) item[key === 'className' ? 'className' : key] = value; for (const child of children) if (child) item.append(child); return item }

    function validate(value) {
      if (!value || typeof value !== "object" || value.version !== 1 || typeof value.id !== "string" || !Array.isArray(value.roots) || !Array.isArray(value.agents) || !Array.isArray(value.groups) || !Array.isArray(value.edges)) throw new Error("canvas: graph snapshot is invalid")
      for (const agent of value.agents) if (!agent || typeof agent.id !== "string" || typeof agent.name !== "string" || typeof agent.status !== "string") throw new Error("canvas: agent is invalid")
      return value
    }
    function detail() {
      const width = state.plane?.clientWidth || state.surface?.clientWidth || 1; const height = state.plane?.clientHeight || state.surface?.clientHeight || 1
      return { snapshot: state.snapshot, plane: state.plane, origin: { x: width / 2, y: height / 2 }, offsetX: 0, offsetY: 0 }
    }
    function render() {
      if (!state.plane || !state.surface || !state.origin) return
      state.plane.style.width = String(Math.max(state.surface.clientWidth, 640) + state.extent.width) + "px"; state.plane.style.height = String(Math.max(state.surface.clientHeight, 480) + state.extent.height) + "px"
      const width = state.plane.clientWidth || parseFloat(state.plane.style.width); const height = state.plane.clientHeight || parseFloat(state.plane.style.height)
      state.origin.style.left = String(width / 2) + "px"; state.origin.style.top = String(height / 2) + "px"
      state.plane.querySelectorAll(".canvas-status").forEach(item => item.remove())
      if (!state.snapshot) { state.plane.append(node("div", { className: "canvas-status" }, text(state.error || "Loading graph…"))); return }
      const note = state.plane.querySelector(".canvas-note"); if (note) note.textContent = state.snapshot.agents.length === 0 ? "Empty session — only the origin exists" : "Session grown — graph radiates from the singularity"
      emit("canvas:graph", detail())
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
      if (direction === 'left' || direction === 'right') state.extent.width += 600
      if (direction === 'up' || direction === 'down') state.extent.height += 500
      render()
    }
    function mount(root) {
      state.generation += 1; const generation = state.generation; state.extent = { width: 0, height: 0 }
      state.root = root; state.surface = node("div", { className: "canvas-surface" }); state.plane = node("div", { className: "canvas-plane" })
      state.origin = node("div", { className: "canvas-origin", "aria-label": "Singularity origin" }, node("div", { className: "canvas-orbit canvas-orbit-outer" }), node("div", { className: "canvas-orbit canvas-orbit-mid" }), node("div", { className: "canvas-orbit canvas-orbit-inner" }), node("div", { className: "canvas-core" }))
      state.plane.append(state.origin, node("div", { className: "canvas-layer canvas-groups" }), node("svg", { className: "canvas-layer canvas-edges", width: "100%", height: "100%" }), node("div", { className: "canvas-layer canvas-nodes" }), node("div", { className: "canvas-note" }))
      state.root.append(node("div", { className: "canvas-live" }, node("span", {}, node("i"), text("Live"))))
      state.surface.append(state.plane); root.append(state.surface); render(); load(generation).then(() => { if (generation === state.generation) connect(generation) }).catch(error => { if (generation !== state.generation) return; state.error = error instanceof Error ? error.message : String(error); render() })
    }
    function unmount() {
      state.generation += 1; state.source?.close(); state.source = null; state.snapshot = null; state.error = ''; state.root?.replaceChildren()
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
        document.addEventListener('canvas:expand', expand); window.addEventListener('resize', render)
        const disposePreset = ctx.remote.$on('agent-preset/selected', onPreset)
        return () => {
          document.removeEventListener('canvas:expand', expand); window.removeEventListener('resize', render)
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
