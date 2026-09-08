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
.canvas-root{--singularity-bg:var(--dsh-color-background,var(--color-background,#f8fafc));--singularity-surface:var(--dsh-color-surface,var(--color-surface,#fff));--singularity-surface-muted:var(--dsh-color-surface-muted,var(--color-surface-muted,#f1f5f9));--singularity-border:var(--dsh-color-border,var(--color-border,#dbe3ee));--singularity-text:var(--dsh-color-text,var(--color-text,#1f2937));--singularity-muted:var(--dsh-color-muted,var(--color-muted,#64748b));--singularity-blue:#3b82f6;--singularity-green:#10b981;position:relative;display:flex;flex:1;min-height:0;overflow:hidden;background:var(--singularity-bg);color:var(--singularity-text);font:12px Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:light dark}
.canvas-surface{position:relative;flex:1;min-height:0;overflow:auto;background:var(--singularity-bg)}.canvas-plane{position:relative;background:var(--singularity-bg)}.canvas-layer{position:absolute;inset:0}.canvas-groups{z-index:1}.canvas-edges{z-index:1;pointer-events:none}.canvas-nodes{z-index:2}.canvas-connection-overlay{z-index:5;pointer-events:none}.canvas-origin{position:absolute;z-index:3;width:320px;height:320px;transform:translate(-50%,-50%);pointer-events:none}.canvas-orbit{position:absolute;inset:50%;transform:translate(-50%,-50%);border:1px dashed color-mix(in srgb,var(--singularity-border) 72%,transparent);border-radius:50%}.canvas-orbit-outer{width:320px;height:320px}.canvas-orbit-mid{width:208px;height:208px}.canvas-orbit-inner{width:144px;height:144px;border-color:color-mix(in srgb,var(--singularity-blue) 24%,var(--singularity-border))}.canvas-core{position:absolute;left:50%;top:50%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:50%;background:color-mix(in srgb,var(--singularity-blue) 13%,var(--singularity-surface));box-shadow:0 0 0 16px color-mix(in srgb,var(--singularity-blue) 8%,var(--singularity-surface)),0 0 0 32px color-mix(in srgb,var(--singularity-blue) 4%,var(--singularity-bg)),0 0 36px color-mix(in srgb,var(--singularity-blue) 36%,transparent)}.canvas-core:before{content:"";position:absolute;inset:16px;border-radius:50%;background:color-mix(in srgb,var(--singularity-blue) 36%,var(--singularity-surface))}.canvas-core:after{content:"";position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 0 10px 3px color-mix(in srgb,var(--singularity-blue) 72%,transparent)}.canvas-note{position:absolute;z-index:4;left:19px;bottom:16px;color:var(--singularity-muted);font-size:11px}.canvas-status{position:absolute;z-index:4;left:24px;top:24px;color:var(--singularity-muted);font-weight:600}
:root[data-theme="dark"] .canvas-root,:root[data-color-scheme="dark"] .canvas-root,[data-theme="dark"] .canvas-root,[data-color-scheme="dark"] .canvas-root{--singularity-bg:#11151c;--singularity-surface:#1a202b;--singularity-surface-muted:#202938;--singularity-border:#334155;--singularity-text:#e5e7eb;--singularity-muted:#94a3b8}@media(prefers-color-scheme:dark){.canvas-root{--singularity-bg:#11151c;--singularity-surface:#1a202b;--singularity-surface-muted:#202938;--singularity-border:#334155;--singularity-text:#e5e7eb;--singularity-muted:#94a3b8}}
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
      state.source.addEventListener('pr-bot/path', event => { if (generation !== state.generation) return; emit('singularity:pr-bot/path', JSON.parse(event.data)) })
      state.source.addEventListener('pr-bot/sent', event => { if (generation !== state.generation) return; emit('singularity:pr-bot/sent', JSON.parse(event.data)) })
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

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/node',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-node-style'
    const CSS = `.canvas-node{position:absolute;z-index:2;box-sizing:border-box;width:134px;height:46px;padding:9px 11px;border:1px solid var(--singularity-border,#dbe3ee);border-radius:10px;background:var(--singularity-surface,#fff);color:var(--singularity-text,#1f2937);cursor:pointer;box-shadow:0 6px 22px color-mix(in srgb,var(--singularity-text,#1f2937) 10%,transparent);transition:border-color .15s,box-shadow .15s,transform .15s;animation:singularity-node-grow .24s ease-out}.canvas-node:hover,.canvas-node[data-selected="true"]{border-color:var(--singularity-blue,#3b82f6);box-shadow:0 8px 28px color-mix(in srgb,var(--singularity-blue,#3b82f6) 24%,transparent)}.canvas-node[data-selected="true"]{transform:translateY(-1px)}.canvas-node[data-status="running"]{border-color:color-mix(in srgb,var(--singularity-blue,#3b82f6) 58%,var(--singularity-border,#dbe3ee))}.canvas-node[data-status="failed"]{border-color:#ef4444}.canvas-node-name{font-weight:700;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-node-meta{margin-top:4px;color:var(--singularity-muted,#64748b);font-size:10px;display:flex;justify-content:space-between;gap:12px}.canvas-node-report{position:absolute;right:5px;top:5px;width:18px;height:18px;border:0;border-radius:5px;background:transparent;color:var(--singularity-muted,#64748b);cursor:pointer}.canvas-node-report:hover{background:var(--singularity-surface-muted,#f1f5f9);color:var(--singularity-text,#1f2937)}.canvas-node-unread{position:absolute;right:6px;top:6px;width:6px;height:6px;border-radius:50%;background:#ef4444;display:none;box-shadow:0 0 0 2px var(--singularity-surface,#fff)}.canvas-node[data-unread="true"] .canvas-node-unread{display:block}.canvas-dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:5px;background:var(--singularity-muted,#64748b)}.canvas-dot[data-status="running"]{background:var(--singularity-blue,#3b82f6)}.canvas-dot[data-status="done"]{background:var(--singularity-green,#10b981)}.canvas-dot[data-status="failed"]{background:#ef4444}.canvas-dot[data-status="waiting"]{background:#f59e0b}.canvas-dot[data-status="idle"]{background:var(--singularity-muted,#64748b)}.canvas-group{position:absolute;z-index:1;border:1px solid var(--singularity-border,#dbe3ee);background:color-mix(in srgb,var(--singularity-surface,#fff) 66%,transparent);border-radius:12px;cursor:pointer}.canvas-group-label{position:absolute;top:8px;left:10px;color:var(--singularity-muted,#64748b);font-size:10px;font-weight:700}.canvas-inspector{position:absolute;z-index:4;right:19px;top:19px;width:224px;box-sizing:border-box;padding:12px;border:1px solid var(--singularity-border,#dbe3ee);border-radius:12px;background:var(--singularity-surface,#fff);color:var(--singularity-text,#1f2937);box-shadow:0 8px 24px color-mix(in srgb,var(--singularity-text,#1f2937) 18%,transparent)}.canvas-inspector-title{font-weight:700;font-size:12px}.canvas-inspector-subtitle{margin-top:6px;color:var(--singularity-muted,#64748b);font-size:10px}.canvas-session-transcript{padding:10px 12px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;min-height:100%}.canvas-session-message{display:flex;flex-direction:column;gap:3px}.canvas-session-role{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--singularity-muted,#64748b)}.canvas-session-message[data-role="user"] .canvas-session-role{color:var(--singularity-blue,#3b82f6)}.canvas-session-text{font-size:12px;line-height:16px;white-space:pre-wrap;word-break:break-word;color:var(--singularity-text,#1f2937)}.canvas-session-empty{padding:10px 12px;color:var(--singularity-muted,#64748b);font-size:11px}@keyframes singularity-node-grow{from{opacity:0;transform:scale(.84)}to{opacity:1;transform:scale(1)}}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    let selectedAgentId
    let sessionService
    function layout(snapshot, origin) {
      if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error("node: graph origin is invalid")
      const roots = new Set(snapshot.roots); const agents = [...snapshot.agents].sort((a, b) => Number(roots.has(b.id)) - Number(roots.has(a.id))); const result = new Map()
      agents.forEach((agent, index) => {
        const ring = Math.floor(index / 6); const radius = 172 + ring * 112
        const angle = -Math.PI / 2 + (index % 6) * Math.PI / 3 + (ring % 2 ? Math.PI / 6 : 0)
        result.set(agent.id, { x: origin.x + Math.cos(angle) * radius - 67, y: origin.y + Math.sin(angle) * radius - 23, width: 134, height: 46 })
      })
      return result
    }
    function inspector(root, agent) {
      root.querySelector(".canvas-inspector")?.remove(); if (!agent) return
      root.append(h("aside", { className: "canvas-inspector" }, h("div", { className: "canvas-inspector-title" }, text(agent.name)), h("div", { className: "canvas-inspector-subtitle" }, text("spawned from singularity · " + agent.status))))
    }
    function blocksText(content) {
      if (!Array.isArray(content)) return ''
      return content.map(block => block && block.type === 'text' ? block.text : '').filter(Boolean).join('\n')
    }
    function sessionTranscript(agent, sessions) {
      const body = document.createElement('div')
      body.className = 'canvas-session-transcript'
      body.dataset.sessionId = String(agent.id)
      const binding = sessions.binding(agent.id)
      if (!binding) throw new Error('node: session binding is missing for ' + agent.id)
      const paint = () => {
        body.replaceChildren()
        const rows = []
        for (const entry of binding.eventSource.getSnapshot().entries) {
          if (entry.type !== 'event') continue
          const event = entry.event
          if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
            const value = blocksText(event.data.content)
            if (value) rows.push({ role: 'user', text: value })
          } else if (event.type === 'assistant/message') {
            const value = blocksText(event.data.message?.content)
            if (value) rows.push({ role: 'assistant', text: value })
          }
        }
        for (const pending of binding.session.getSnapshot().pendingSubmissions) {
          if (pending.placement !== 'transcript' || !pending.text) continue
          rows.push({ role: 'user', text: pending.text })
        }
        if (rows.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'canvas-session-empty'
          empty.textContent = 'No messages yet'
          body.append(empty)
          return
        }
        for (const row of rows) {
          const item = document.createElement('div')
          item.className = 'canvas-session-message'
          item.dataset.role = row.role
          const role = document.createElement('div')
          role.className = 'canvas-session-role'
          role.textContent = row.role
          const content = document.createElement('div')
          content.className = 'canvas-session-text'
          content.textContent = row.text
          item.append(role, content)
          body.append(item)
        }
      }
      paint()
      const stopEvents = binding.eventSource.subscribe(paint)
      const stopSession = binding.session.subscribe(paint)
      return { body, dispose: () => { stopEvents(); stopSession() } }
    }
    function select(agent, root, sessions) {
      selectedAgentId = agent.id
      sessions.open(agent.id)
      document.dispatchEvent(new CustomEvent("singularity:agent", { detail: agent }))
      if (!document.querySelector('[data-sticky-id="session:' + agent.id + '"]')) {
        const panel = sessionTranscript(agent, sessions)
        document.dispatchEvent(new CustomEvent('sticky:open', { detail: { id: `session:${agent.id}`, title: 'Session', body: panel.body, dispose: panel.dispose, target: agent, session: true } }))
      }
      document.dispatchEvent(new CustomEvent("singularity:node-selected", { detail: { agent, agentId: agent.id } }))
      inspector(root, agent)
      document.querySelectorAll('.canvas-node').forEach(item => { item.dataset.selected = String(item.dataset.agentId === selectedAgentId) })
    }
    function draw(event) {
      const layer = document.querySelector(".canvas-nodes"); const groups = document.querySelector(".canvas-groups"); const root = document.querySelector(".canvas-root"); if (!layer || !groups || !root) throw new Error("node: canvas layers are not mounted")
      const snapshot = event.detail.snapshot; const positions = layout(snapshot, event.detail.origin); layer.replaceChildren(); groups.replaceChildren(); const byId = new Map(snapshot.agents.map(agent => [agent.id, agent]))
      if (selectedAgentId !== undefined && !byId.has(selectedAgentId)) selectedAgentId = undefined
      snapshot.groups.forEach(group => { const members = group.memberIds.map(id => byId.get(id)); if (members.some(agent => !agent)) throw new Error("node: group " + group.id + " references an unknown agent"); const nodes = members.map(agent => positions.get(agent.id)); if (nodes.some(item => !item)) throw new Error("node: group " + group.id + " has no visual position"); const x = Math.min(...nodes.map(item => item.x)) - 22; const y = Math.min(...nodes.map(item => item.y)) - 30; const width = Math.max(...nodes.map(item => item.x + item.width)) - x + 22; const height = Math.max(...nodes.map(item => item.y + item.height)) - y + 30; const box = h("div", { className: "canvas-group", style: "left:" + x + "px;top:" + y + "px;width:" + width + "px;height:" + height + "px" }, h("div", { className: "canvas-group-label" }, text("Group " + group.id))); box.onclick = () => document.dispatchEvent(new CustomEvent("singularity:group", { detail: group })); groups.append(box) })
      snapshot.agents.forEach(agent => { const position = positions.get(agent.id); if (!position) throw new Error("node: agent " + agent.id + " has no visual position"); const item = h("article", { className: "canvas-node", dataset: { agentId: agent.id, shape: "card", status: agent.status, unread: "false", selected: String(agent.id === selectedAgentId) }, style: "left:" + position.x + "px;top:" + position.y + "px;width:" + position.width + "px;height:" + position.height + "px" }, h("span", { className: "canvas-node-unread" }), h("div", { className: "canvas-node-name" }, text(agent.name)), h("div", { className: "canvas-node-meta" }, h("span", {}, h("span", { className: "canvas-dot", dataset: { status: agent.status } }), text(agent.status)), h("span", {}, text(agent.routerFor ? "router" : "agent")))); const report = h("button", { className: "canvas-node-report", title: "Open report", "aria-label": "Open report" }, text("i")); report.onclick = event => { event.stopPropagation(); document.dispatchEvent(new CustomEvent("singularity:report", { detail: agent })) }; item.onclick = () => { document.dispatchEvent(new CustomEvent("singularity:unread", { detail: { agentId: agent.id, unread: false } })); select(agent, root, sessionService) }; layer.append(item) })
      inspector(root, selectedAgentId === undefined ? undefined : byId.get(selectedAgentId))
    }
    function focus(event) {
      const id = event.detail?.agentId; const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === id); if (!item) throw new Error("node: focus target is not rendered: " + String(id)); item.click(); item.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
    function unread(event) { const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === event.detail.agentId); if (item) item.dataset.unread = String(event.detail.unread) }
    function apply(ctx) { sessionService = ctx.sessions; ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:unread', unread); document.addEventListener('singularity:focus-node', focus); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:unread', unread); document.removeEventListener('singularity:focus-node', focus); sessionService = undefined; style.remove() } }, 'node: lifecycle') }
    module.exports.apply = apply
    module.exports.inject = ['sessions']
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/connect',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-connect-style'
    const CSS = `.canvas-edges path{fill:none;stroke:color-mix(in srgb,var(--singularity-border,#dbe3ee) 86%,transparent);stroke-width:1.25;opacity:.55;vector-effect:non-scaling-stroke}.canvas-edges path[data-kind="handoff"]{stroke:color-mix(in srgb,var(--singularity-blue,#3b82f6) 56%,var(--singularity-border,#dbe3ee));stroke-dasharray:5 4}.canvas-edges path[data-selected="true"]{stroke:var(--singularity-blue,#3b82f6);stroke-width:2.5;opacity:1}.canvas-pr-bot-overlay{position:fixed;inset:0;z-index:2147480999;width:100%;height:100%;pointer-events:none;overflow:visible}.canvas-pr-bot-path{fill:none;stroke-width:2.5;stroke-linecap:round;vector-effect:non-scaling-stroke}.canvas-pr-bot-path[data-path="pr"]{stroke:var(--singularity-blue,#3b82f6)}.canvas-pr-bot-path[data-path="bot"]{stroke:#7c3aed;stroke-dasharray:5 4}.canvas-pr-bot-endpoint[data-path="pr"]{fill:var(--singularity-blue,#3b82f6)}.canvas-pr-bot-endpoint[data-path="bot"]{fill:#7c3aed}.canvas-pr-bot-ring{fill:none;stroke:#7c3aed;stroke-width:1.5;opacity:.35}`
    let lastEvent
    let selectedAgentId
    const markers = []
    const sent = new Set()
    function point(node) { return { x: node.offsetLeft + node.offsetWidth / 2, y: node.offsetTop + node.offsetHeight / 2 } }
    function path(from, to) { const dx = to.x - from.x; const bend = Math.max(34, Math.abs(dx) * .28); return `M ${from.x} ${from.y} C ${from.x + (dx >= 0 ? bend : -bend)} ${from.y}, ${to.x - (dx >= 0 ? bend : -bend)} ${to.y}, ${to.x} ${to.y}` }
    function composer() { return document.querySelector('[data-singularity-composer]') }
    function key(event) {
      if (!event || (event.path !== "pr" && event.path !== "bot")) throw new Error("connect: pr-bot event has an invalid path")
      if (event.path === "bot" && event.target && typeof event.target.sessionId === "string" && event.target.sessionId.length > 0) return `bot:${event.target.sessionId}`
      if (event.path === "pr" && event.target && typeof event.target.repo === "string" && event.target.repo.length > 0 && Number.isSafeInteger(event.target.number) && event.target.number > 0) return `pr:${event.target.repo}#${event.target.number}`
      throw new Error("connect: pr-bot event has an invalid target")
    }
    function targetFor(marker) {
      if (marker.path === 'bot') return [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === marker.target.sessionId)
      const targetKey = `${marker.target.repo}#${marker.target.number}`
      const explicit = [...document.querySelectorAll('[data-singularity-pr-target]')].find(node => node.dataset.singularityPrTarget === targetKey)
      if (explicit) return explicit
      return undefined
    }
    function svg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag) }
    function drawMarkers() {
      document.querySelector('.canvas-pr-bot-overlay')?.remove()
      if (markers.length === 0 && sent.size === 0) return
      const source = composer()
      if (!source) return
      const sourceRect = source.getBoundingClientRect()
      const from = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 }
      const overlay = svg('svg'); overlay.classList.add('canvas-pr-bot-overlay'); overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)
      for (const marker of markers) {
        if (!marker.hasPath) continue
        const target = targetFor(marker); if (!target) continue
        const rect = target.getBoundingClientRect(); const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        const line = svg('path'); line.classList.add('canvas-pr-bot-path'); line.dataset.path = marker.path; line.setAttribute('d', path(from, to)); overlay.append(line)
        const endpoint = svg('circle'); endpoint.classList.add('canvas-pr-bot-endpoint'); endpoint.dataset.path = marker.path; endpoint.setAttribute('cx', String(to.x)); endpoint.setAttribute('cy', String(to.y)); endpoint.setAttribute('r', '4'); overlay.append(endpoint)
      }
      for (const marker of markers) {
        const markerKey = key(marker); if (!markerKey || !sent.has(markerKey)) continue
        const target = targetFor(marker); if (!target) continue
        const rect = target.getBoundingClientRect(); const ring = svg('circle'); ring.classList.add('canvas-pr-bot-ring'); ring.setAttribute('cx', String(rect.left + rect.width / 2)); ring.setAttribute('cy', String(rect.top + rect.height / 2)); ring.setAttribute('r', '10'); overlay.append(ring)
      }
      if (overlay.childNodes.length > 0) document.body.append(overlay)
    }
    function receivePath(event) {
      const detail = event.detail
      const markerKey = key(detail)
      const existing = markers.find(marker => key(marker) === markerKey)
      if (existing) existing.hasPath = true
      else markers.push({ path: detail.path, target: detail.target, hasPath: true })
      drawMarkers()
    }
    function receiveSent(event) {
      const detail = event.detail
      const markerKey = key(detail)
      sent.add(markerKey)
      if (!markers.some(marker => key(marker) === markerKey)) markers.push({ path: detail.path, target: detail.target, hasPath: false })
      drawMarkers()
    }
    function draw(event) {
      lastEvent = event
      const layer = document.querySelector('.canvas-edges'); if (!layer) throw new Error('connect: edge layer is not mounted'); const origin = event.detail.origin; if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error('connect: graph origin is invalid')
      layer.replaceChildren(); const byId = new Map(event.detail.snapshot.agents.map(agent => [agent.id, agent])); const edges = new Map(event.detail.snapshot.edges.map(edge => [edge.to, edge]))
      const selectedPath = new Set()
      if (selectedAgentId !== undefined) {
        let id = selectedAgentId
        while (id !== undefined) {
          selectedPath.add(id)
          id = edges.get(id)?.from
        }
      }
      for (const agent of event.detail.snapshot.agents) { const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === agent.id); if (!item) throw new Error('connect: agent ' + agent.id + ' has no rendered node'); const target = point(item); const edge = edges.get(agent.id); const from = edge ? [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === edge.from) : undefined; const start = from ? point(from) : origin; const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path'); curve.setAttribute('d', path(start, target)); curve.dataset.to = agent.id; if (edge) curve.dataset.kind = edge.kind; if (edge && !byId.has(edge.from)) throw new Error('connect: edge ' + edge.id + ' references an unknown source'); if (selectedPath.has(agent.id)) curve.dataset.selected = 'true'; layer.append(curve) }
      drawMarkers()
    }
    function select(event) { const agentId = event.detail?.agentId; if (agentId === undefined) throw new Error('connect: node selection has no agentId'); selectedAgentId = agentId; if (lastEvent) draw(lastEvent) }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:node-selected', select); document.addEventListener('singularity:pr-bot/path', receivePath); document.addEventListener('singularity:pr-bot/sent', receiveSent); window.addEventListener('resize', drawMarkers); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:node-selected', select); document.removeEventListener('singularity:pr-bot/path', receivePath); document.removeEventListener('singularity:pr-bot/sent', receiveSent); window.removeEventListener('resize', drawMarkers); document.querySelector('.canvas-pr-bot-overlay')?.remove(); lastEvent = undefined; selectedAgentId = undefined; markers.length = 0; sent.clear(); style.remove() } }, 'connect: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/sticky',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-sticky-style'
    const CSS = `.sticky{position:fixed;z-index:2147481000;width:360px;height:380px;display:flex;flex-direction:column;background:var(--singularity-surface,var(--color-surface,#fff));color:var(--singularity-text,var(--color-text,#1f2937));border:1px solid var(--singularity-border,var(--color-border,#dbe3ee));border-radius:12px;box-shadow:0 10px 28px color-mix(in srgb,var(--singularity-text,#1f2937) 18%,transparent)}.sticky.min{height:40px;width:240px}.sticky[data-pinned="true"]{border-color:color-mix(in srgb,#10b981 58%,var(--singularity-border,#dbe3ee))}.sticky-head{height:40px;flex:none;display:flex;align-items:center;padding:0 8px 0 14px;border-bottom:1px solid var(--singularity-border,var(--color-border,#dbe3ee));background:var(--singularity-surface,var(--color-surface,#fff));color:var(--singularity-text,var(--color-text,#1f2937));cursor:move}.sticky-title{min-width:0;flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sticky-actions{display:flex;gap:2px}.sticky-button{width:28px;height:28px;padding:0;border:0;background:none;border-radius:6px;cursor:pointer;color:var(--singularity-muted,var(--color-muted,#64748b));font:inherit}.sticky-button:hover,.sticky[data-pinned="true"] .sticky-pin{background:color-mix(in srgb,#10b981 14%,transparent);color:#10b981}.sticky-body{min-height:0;flex:1;overflow:auto;color:var(--singularity-text,var(--color-text,#1f2937))}`
    const windows = new Map()
    const h = (tag, props = {}) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); return node }
    function changed(item) { document.dispatchEvent(new CustomEvent('sticky:changed', { detail: { id: item.id, node: item.node, target: item.target, pinned: item.pinned } })) }
    function select(item) { document.dispatchEvent(new CustomEvent('sticky:selected', { detail: { id: item.id, node: item.node, target: item.target, pinned: item.pinned } })) }
    function remove(id) { const item = windows.get(id); if (!item) return; windows.delete(id); item.node.remove(); item.dispose?.(); document.dispatchEvent(new CustomEvent('sticky:changed', { detail: { id } })) }
    function close(item) { remove(item.id); document.dispatchEvent(new CustomEvent('sticky:closed', { detail: { id: item.id, target: item.target } })) }
    function closed(event) { remove(event.detail.id) }
    function closeUnlocked() { for (const item of [...windows.values()]) if (!item.pinned) close(item) }
    function open(event) {
      const { id, title, body, target, dispose, session = false, pinned = false } = event.detail
      if (id === undefined || id === null || title === undefined || !body) throw new Error('sticky: id, title, and body are required')
      const key = String(id)
      if (windows.has(key)) return
      closeUnlocked()
      const canvas = document.getElementById('canvas-root'); const canvasRect = canvas?.getBoundingClientRect(); const x = event.detail.x ?? (canvasRect ? window.innerWidth - canvasRect.right + 24 + windows.size * 26 : 24 + windows.size * 26); const y = event.detail.y ?? 24 + windows.size * 26
      const node = h('section', { className: 'sticky', style: `right:${x}px;bottom:${y}px` }); const head = h('header', { className: 'sticky-head' }); const label = h('div', { className: 'sticky-title' }); label.textContent = title; const actions = h('div', { className: 'sticky-actions' }); const pin = h('button', { className: 'sticky-button sticky-pin', type: 'button', title: pinned ? 'Unpin' : 'Pin', 'aria-label': pinned ? 'Unpin' : 'Pin' }); pin.textContent = '●'; const min = h('button', { className: 'sticky-button', type: 'button', title: 'Minimize', 'aria-label': 'Minimize' }); min.textContent = '−'; const shut = h('button', { className: 'sticky-button', type: 'button', title: 'Close', 'aria-label': 'Close' }); shut.textContent = '×'; actions.append(pin, min, shut); head.append(label, actions); const content = h('div', { className: 'sticky-body' }); content.append(body); node.append(head, content); document.body.append(node)
      node.dataset.stickyId = key; node.dataset.sessionSticky = String(session); node.dataset.pinned = String(pinned); if (target?.id) node.dataset.targetId = String(target.id)
      const item = { id: key, node, target, dispose, session: session || key.startsWith('session:'), pinned, min: false }; windows.set(key, item); node.onclick = () => select(item); pin.onclick = event => { event.stopPropagation(); item.pinned = !item.pinned; node.dataset.pinned = String(item.pinned); pin.title = item.pinned ? 'Unpin' : 'Pin'; pin.setAttribute('aria-label', pin.title); changed(item); select(item) }; shut.onclick = event => { event.stopPropagation(); close(item) }; min.onclick = event => { event.stopPropagation(); item.min = !item.min; node.classList.toggle('min', item.min); changed(item) }
      let drag; label.onpointerdown = pointer => { drag = { x: pointer.clientX, y: pointer.clientY, right: x, bottom: y }; label.setPointerCapture?.(pointer.pointerId); select(item) }; head.onpointermove = pointer => { if (!drag) return; node.style.right = `${drag.right - pointer.clientX + drag.x}px`; node.style.bottom = `${drag.bottom - pointer.clientY + drag.y}px`; changed(item) }; head.onpointerup = () => { drag = undefined; changed(item) }
      select(item)
    }
    function clear() { for (const item of [...windows.values()]) close(item) }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('sticky:open', open); document.addEventListener('sticky:closed', closed); document.addEventListener('canvas:close', clear); return () => { document.removeEventListener('sticky:open', open); document.removeEventListener('sticky:closed', closed); document.removeEventListener('canvas:close', clear); clear(); style.remove() } }, 'sticky: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/report',
  factory: () => {
    const module = { exports: {} }
    function open(event) { const agent = event.detail; const body = document.createElement('pre'); body.textContent = JSON.stringify({ id: agent.id, name: agent.name, status: agent.status, memberOf: agent.memberOf, routerFor: agent.routerFor, node: agent.node }, null, 2); document.dispatchEvent(new CustomEvent('sticky:open', { detail: { id: `report:${agent.id}`, title: `${agent.name} report`, body, target: agent } })) }
    function apply(ctx) { ctx.effect(() => { document.addEventListener('singularity:report', open); return () => document.removeEventListener('singularity:report', open) }, 'report: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/chat',
  factory: () => ({ apply() {} }),
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/human',
  factory: () => {
    const module = { exports: {} }
    function open(event) { const request = event.detail; const body = document.createElement('div'); const message = document.createElement('p'); message.textContent = request.message; const answer = document.createElement('textarea'); answer.rows = 4; answer.placeholder = 'Response'; const send = document.createElement('button'); send.type = 'button'; send.textContent = 'Respond'; send.onclick = () => { if (!answer.value) throw new Error('human: response is empty'); document.dispatchEvent(new CustomEvent('singularity:human-response', { detail: { ...request, response: answer.value } })); answer.value = '' }; body.append(message, answer, send); document.dispatchEvent(new CustomEvent('sticky:open', { detail: { id: `human:${request.id}`, title: 'Human intervention', body, target: request.agent ?? request } })) }
    function apply(ctx) { ctx.effect(() => { document.addEventListener('singularity:human', open); return () => document.removeEventListener('singularity:human', open) }, 'human: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/bubble',
  factory: () => {
    const module = { exports: {} }
    const queue = []; const names = new Map(); let source; let canvasOpen = false; const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); for (const child of children) if (child) node.append(child); return node }; const text = value => document.createTextNode(String(value)); const STYLE_ID = 'dsh-bubble-style'; const CSS = `#bubble-queue{position:absolute;right:18px;top:16px;z-index:5;width:280px;max-height:250px;overflow:hidden;background:var(--singularity-surface,var(--color-surface,#fff));color:var(--singularity-text,var(--color-text,#1f2937));border:1px solid var(--singularity-border,var(--color-border,#dbe3ee));border-radius:10px;box-shadow:0 10px 28px color-mix(in srgb,var(--singularity-text,#1f2937) 18%,transparent)}#bubble-queue[hidden]{display:none}.bubble-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--singularity-border,var(--color-border,#dbe3ee));color:var(--singularity-text,var(--color-text,#1f2937));font-weight:700}.bubble-count{min-width:20px;padding:2px 6px;border-radius:10px;background:#ff5d63;color:#08090a;text-align:center;font-size:11px}.bubble-list{max-height:204px;overflow:auto}.bubble-item{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--singularity-border,var(--color-border,#dbe3ee));background:var(--singularity-surface,var(--color-surface,#fff));color:var(--singularity-text,var(--color-text,#1f2937));text-align:left;cursor:pointer;font:12px Inter,ui-sans-serif,system-ui,sans-serif}.bubble-item:hover{background:var(--singularity-surface-muted,var(--color-surface-muted,#f1f5f9))}.bubble-agent{display:block;margin-bottom:3px;font-weight:700}.bubble-text{display:block;color:var(--singularity-muted,var(--color-muted,#64748b));font-size:11px}`
    function render() { let panel = document.getElementById('bubble-queue'); const root = document.getElementById('canvas-root'); if (!root) return; if (!panel || !panel.isConnected) { panel = h('aside', { id: 'bubble-queue' }); root.append(panel) } panel.hidden = !canvasOpen || queue.length === 0; panel.replaceChildren(); const heading = h('header', { className: 'bubble-head' }, text('Notifications'), queue.length ? h('span', { className: 'bubble-count' }, text(queue.length)) : null); panel.append(heading); const list = h('div', { className: 'bubble-list' }); queue.forEach((item, index) => { const button = h('button', { className: 'bubble-item', type: 'button' }, h('span', { className: 'bubble-agent' }, text(item.agentName)), h('span', { className: 'bubble-text' }, text(item.text))); button.onclick = () => { queue.splice(index, 1); document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: item.agentId, unread: false } })); document.dispatchEvent(new CustomEvent('singularity:focus-node', { detail: { agentId: item.agentId } })); render() }; list.append(button) }); panel.append(list) }
    function graph(event) { names.clear(); event.detail.snapshot.agents.forEach(agent => names.set(agent.id, agent.name)); for (const item of queue) document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: item.agentId, unread: true } })) }
    function add(event) { const item = JSON.parse(event.data); if (typeof item.agentId !== 'string' || typeof item.text !== 'string') throw new Error('bubble: notice event is invalid'); const agentName = names.get(item.agentId); if (agentName === undefined) throw new Error('bubble: notice references an unknown agent ' + item.agentId); const value = { agentId: item.agentId, agentName, text: item.text }; queue.push(value); document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: value.agentId, unread: true } })); render() }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); source = new EventSource('/singular/notices'); source.addEventListener('notice', add); const opened = () => { canvasOpen = true; render() }; const closed = () => { canvasOpen = false; render() }; document.addEventListener('canvas:graph', graph); document.addEventListener('canvas:open', opened); document.addEventListener('canvas:close', closed); return () => { source.close(); source = undefined; document.removeEventListener('canvas:graph', graph); document.removeEventListener('canvas:open', opened); document.removeEventListener('canvas:close', closed); document.getElementById('bubble-queue')?.remove(); style.remove() } }, 'bubble: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: "@dangosys/dsh-singularity",
  factory: (require) => {
    const module = { exports: {} }
    const plugins = [require("@dangosys/dsh-singularity/canvas"), require("@dangosys/dsh-singularity/node"), require("@dangosys/dsh-singularity/connect"), require("@dangosys/dsh-singularity/sticky"), require("@dangosys/dsh-singularity/report"), require("@dangosys/dsh-singularity/chat"), require("@dangosys/dsh-singularity/human"), require("@dangosys/dsh-singularity/bubble")]
    module.exports.apply = (ctx) => { for (const plugin of plugins) plugin.apply(ctx) }
    module.exports.inject = ['slots', 'sessions', 'remote']
    return module.exports
  },
})
