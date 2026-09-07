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

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/node',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-node-style'
    const CSS = `.canvas-node{position:absolute;z-index:2;box-sizing:border-box;width:160px;height:50px;padding:10px 11px;border:1px solid #242728;border-radius:14px;background:#0E1116;color:#d9dde5;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.34);transition:border-color .15s,box-shadow .15s}.canvas-node[data-selected="true"]{border-color:#4DA3FF;box-shadow:0 0 0 1px rgba(77,163,255,.22),0 10px 28px rgba(0,0,0,.48)}.canvas-node:hover{border-color:#38516d;box-shadow:0 10px 28px rgba(0,0,0,.48);transform:translateY(-1px)}.canvas-node[data-status="running"]{border-color:#385f87}.canvas-node[data-status="failed"]{border-color:#713d43}.canvas-node[data-selected="true"]{border-color:#4DA3FF;box-shadow:0 0 0 1px rgba(77,163,255,.22),0 10px 28px rgba(0,0,0,.48)}.canvas-node-name{font-weight:700;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-node-meta{margin-top:4px;color:#656e7b;font-size:10px;display:flex;justify-content:space-between;gap:12px}.canvas-node-report{position:absolute;right:5px;top:5px;width:18px;height:18px;border:0;border-radius:4px;background:transparent;color:#697483;cursor:pointer}.canvas-node-report:hover{background:#1a1e24;color:#d9dde5}.canvas-node-unread{position:absolute;right:6px;top:6px;width:6px;height:6px;border-radius:50%;background:#ff5d63;display:none;box-shadow:0 0 0 2px #0E1116}.canvas-node[data-unread="true"] .canvas-node-unread{display:block}.canvas-dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:5px;background:#6B7280}.canvas-dot[data-status="idle"]{background:#6B7280}.canvas-dot[data-status="waiting"]{background:#E8B84A}.canvas-dot[data-status="active"]{background:#3DFF8A}.canvas-dot[data-status="running"]{background:#4DA3FF}.canvas-dot[data-status="running"]{background:#4DA3FF}.canvas-dot[data-status="done"]{background:#3DFF8A}.canvas-dot[data-status="failed"]{background:#ff5d63}.canvas-dot[data-status="waiting"]{background:#E8B84A}.canvas-dot[data-status="idle"]{background:#6B7280}.canvas-group{position:absolute;z-index:1;border:1px solid #242728;background:#0E111688;border-radius:14px;cursor:pointer}.canvas-group-label{position:absolute;top:8px;left:10px;color:#626b79;font-size:10px;font-weight:700}.canvas-inspector{position:absolute;z-index:4;right:19px;top:19px;width:224px;box-sizing:border-box;padding:12px;border:1px solid #242728;border-radius:14px;background:#0E1116;color:#d9dde5;box-shadow:0 10px 28px rgba(0,0,0,.42)}.canvas-inspector-title{font-weight:700;font-size:12px}.canvas-inspector-subtitle{margin-top:6px;color:#656e7b;font-size:10px}.canvas-inspector-callout{margin-top:10px;padding:9px;border:1px solid #242728;border-radius:8px;color:#d0d6df;font-size:10px;line-height:14px}.canvas-inspector-callout small{display:block;margin-top:3px;color:#656e7b}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    function layout(snapshot, origin) {
      if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error("node: graph origin is invalid")
      const roots = new Set(snapshot.roots); const agents = [...snapshot.agents].sort((a, b) => Number(roots.has(b.id)) - Number(roots.has(a.id))); const radius = Math.min(250, Math.max(170, Math.min(origin.x, origin.y) * .58)); const result = new Map()
      agents.forEach((agent, index) => { const angle = index === 0 ? -Math.PI / 2 : -Math.PI / 2 + (index % 2 === 1 ? -1 : 1) * Math.ceil(index / 2) * Math.PI / 3; result.set(agent.id, { x: origin.x + Math.cos(angle) * radius - 80, y: origin.y + Math.sin(angle) * radius - 25, width: 160, height: 50 }) })
      return result
    }
    function inspector(root, agent) {
      root.querySelector(".canvas-inspector")?.remove(); if (!agent) return
      root.append(h("aside", { className: "canvas-inspector" }, h("div", { className: "canvas-inspector-title" }, text(agent.name)), h("div", { className: "canvas-inspector-subtitle" }, text("spawned from singularity · " + agent.status)), h("div", { className: "canvas-inspector-callout" }, text("Planning next hop"), h("small", {}, text("Edges grow from the origin as agents spawn.")))))
    }
    function draw(event) {
      const layer = document.querySelector(".canvas-nodes"); const groups = document.querySelector(".canvas-groups"); const root = document.querySelector(".canvas-root"); if (!layer || !groups || !root) throw new Error("node: canvas layers are not mounted")
      const snapshot = event.detail.snapshot; const positions = layout(snapshot, event.detail.origin); layer.replaceChildren(); groups.replaceChildren(); const byId = new Map(snapshot.agents.map(agent => [agent.id, agent]))
      snapshot.groups.forEach(group => { const members = group.memberIds.map(id => byId.get(id)); if (members.some(agent => !agent)) throw new Error("node: group " + group.id + " references an unknown agent"); const nodes = members.map(agent => positions.get(agent.id)); if (nodes.some(item => !item)) throw new Error("node: group " + group.id + " has no visual position"); const x = Math.min(...nodes.map(item => item.x)) - 22; const y = Math.min(...nodes.map(item => item.y)) - 30; const width = Math.max(...nodes.map(item => item.x + item.width)) - x + 22; const height = Math.max(...nodes.map(item => item.y + item.height)) - y + 30; const box = h("div", { className: "canvas-group", style: "left:" + x + "px;top:" + y + "px;width:" + width + "px;height:" + height + "px" }, h("div", { className: "canvas-group-label" }, text("Group " + group.id))); box.onclick = () => document.dispatchEvent(new CustomEvent("singularity:group", { detail: group })); groups.append(box) })
      snapshot.agents.forEach(agent => { const position = positions.get(agent.id); if (!position) throw new Error("node: agent " + agent.id + " has no visual position"); const item = h("article", { className: "canvas-node", dataset: { agentId: agent.id, shape: "card", status: agent.status, selected: String(agent.id === (snapshot.roots[0] ?? snapshot.agents[0]?.id)), unread: "false" }, style: "left:" + position.x + "px;top:" + position.y + "px;width:" + position.width + "px;height:" + position.height + "px" }, h("span", { className: "canvas-node-unread" }), h("div", { className: "canvas-node-name" }, text(agent.name)), h("div", { className: "canvas-node-meta" }, h("span", {}, h("span", { className: "canvas-dot", dataset: { status: agent.status } }), text(agent.status)), h("span", {}, text(agent.routerFor ? "router" : "agent")))); const report = h("button", { className: "canvas-node-report", title: "Open report", "aria-label": "Open report" }, text("i")); report.onclick = event => { event.stopPropagation(); document.dispatchEvent(new CustomEvent("singularity:report", { detail: agent })) }; item.onclick = () => { layer.querySelectorAll(".canvas-node").forEach(node => { node.dataset.selected = "false" }); item.dataset.selected = "true"; document.dispatchEvent(new CustomEvent("singularity:unread", { detail: { agentId: agent.id, unread: false } })); document.dispatchEvent(new CustomEvent("singularity:agent", { detail: agent })); inspector(root, agent) }; layer.append(item) })
      inspector(root, snapshot.agents[0])
    }
    function unread(event) { const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === event.detail.agentId); if (item) item.dataset.unread = String(event.detail.unread) }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:unread', unread); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:unread', unread); style.remove() } }, 'node: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/connect',
  factory: () => {
    const module = { exports: {} }
    function draw(event) {
      const layer = document.querySelector(".canvas-edges"); if (!layer) throw new Error("connect: edge layer is not mounted"); const origin = event.detail.origin; if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error("connect: graph origin is invalid")
      layer.replaceChildren(); const edges = new Map(event.detail.snapshot.edges.map(edge => [edge.to, edge]))
      for (const agent of event.detail.snapshot.agents) { const item = [...document.querySelectorAll(".canvas-node")].find(node => node.dataset.agentId === agent.id); if (!item) throw new Error("connect: agent " + agent.id + " has no rendered node"); const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); const handoff = edges.get(agent.id)?.kind === "handoff"; line.setAttribute("x1", String(origin.x)); line.setAttribute("y1", String(origin.y)); line.setAttribute("x2", String(item.offsetLeft + item.offsetWidth / 2)); line.setAttribute("y2", String(item.offsetTop + item.offsetHeight / 2)); line.setAttribute("stroke", handoff ? "#38516d" : "#293440"); line.setAttribute("stroke-width", handoff ? "1.4" : "1"); line.setAttribute("stroke-dasharray", handoff ? "5 4" : "none"); line.setAttribute("opacity", "0.9"); layer.append(line) }
    }
    function apply(ctx) { ctx.effect(() => { document.addEventListener('canvas:graph', draw); return () => document.removeEventListener('canvas:graph', draw) }, 'connect: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/sticky',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-sticky-style'
    const CSS = `.sticky{position:fixed;z-index:2147481000;width:360px;height:380px;display:flex;flex-direction:column;background:#0e1014;color:#d9dde5;border:1px solid #242728;border-radius:10px;box-shadow:0 10px 28px #0009}.sticky.min{height:40px;width:240px}.sticky-head{height:40px;flex:none;display:flex;align-items:center;padding:0 8px 0 14px;border-bottom:1px solid #242728;background:#0e1014;color:#d9dde5;cursor:move}.sticky-title{min-width:0;flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sticky-actions{display:flex;gap:2px}.sticky-button{width:28px;height:28px;padding:0;border:0;background:none;border-radius:5px;cursor:pointer;color:#737d8b;font:inherit}.sticky-button:hover{background:#1a1e24;color:#d9dde5}.sticky-body{min-height:0;flex:1;overflow:auto;color:#d9dde5}`
    const windows = new Map()
    const h = (tag, props = {}) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); return node }
    function changed(item) { document.dispatchEvent(new CustomEvent('sticky:changed', { detail: { id: item.id, node: item.node, target: item.target } })) }
    function select(item) { document.dispatchEvent(new CustomEvent('sticky:selected', { detail: { id: item.id, node: item.node, target: item.target } })) }
    function remove(id) { const key = String(id); const item = windows.get(id); if (item) { windows.delete(id); item.node.remove(); item.dispose?.() } document.querySelectorAll('.sticky').forEach(node => { if (node.dataset.stickyId === key) node.remove() }); document.dispatchEvent(new CustomEvent('sticky:changed', { detail: { id } })) }
    function close(item) { remove(item.id); document.dispatchEvent(new CustomEvent('sticky:closed', { detail: { id: item.id, target: item.target } })) }
    function closed(event) { remove(event.detail.id) }
    function open(event) {
      const { id, title, body, target, dispose, session = false } = event.detail
      if (String(id).startsWith('chat:') || String(id).startsWith('session:')) { document.querySelectorAll('.sticky').forEach(node => { if (node.dataset.stickyId === String(id)) node.remove() }); return }
      if (windows.has(id) || [...document.querySelectorAll('.sticky')].some(node => node.dataset.stickyId === String(id))) return
      const canvas = document.getElementById('canvas-root'); const canvasRect = canvas?.getBoundingClientRect(); const x = event.detail.x ?? (canvasRect ? window.innerWidth - canvasRect.right + 24 + windows.size * 26 : 24 + windows.size * 26); const y = event.detail.y ?? 24 + windows.size * 26
      const node = h('section', { className: 'sticky', style: `right:${x}px;bottom:${y}px` }); const head = h('header', { className: 'sticky-head' }); const label = h('div', { className: 'sticky-title' }); label.textContent = title; const actions = h('div', { className: 'sticky-actions' }); const min = h('button', { className: 'sticky-button', type: 'button', title: 'Minimize', 'aria-label': 'Minimize' }); min.textContent = '−'; const shut = h('button', { className: 'sticky-button', type: 'button', title: 'Close', 'aria-label': 'Close' }); shut.textContent = '×'; actions.append(min, shut); head.append(label, actions); const content = h('div', { className: 'sticky-body' }); content.append(body); node.append(head, content); document.body.append(node)
      node.dataset.stickyId = String(id); node.dataset.sessionSticky = String(session); if (target?.id) node.dataset.targetId = String(target.id)
      const item = { id, node, target, dispose, session, min: false }; windows.set(id, item); node.onclick = () => select(item); shut.onclick = event => { event.stopPropagation(); close(item) }; min.onclick = event => { event.stopPropagation(); item.min = !item.min; node.classList.toggle('min', item.min); changed(item) }
      let drag; label.onpointerdown = pointer => { drag = { x: pointer.clientX, y: pointer.clientY, right: x, bottom: y }; label.setPointerCapture?.(pointer.pointerId); select(item) }; head.onpointermove = pointer => { if (!drag) return; node.style.right = `${drag.right - pointer.clientX + drag.x}px`; node.style.bottom = `${drag.bottom - pointer.clientY + drag.y}px`; changed(item) }; head.onpointerup = () => { drag = undefined; changed(item) }
      select(item)
    }
    function clear() { for (const item of [...windows.values()]) close(item) }
    function clearLegacy() { for (const node of [...document.querySelectorAll('.sticky')]) { const id = node.dataset.stickyId ?? ''; if (node.dataset.sessionSticky === 'true' || id.startsWith('chat:') || id.startsWith('session:')) node.remove() } for (const [id, item] of windows) { const key = String(id); if (item.session || key.startsWith('chat:') || key.startsWith('session:')) { windows.delete(id); item.dispose?.() } } }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); clearLegacy(); document.addEventListener('sticky:open', open); document.addEventListener('sticky:closed', closed); document.addEventListener('canvas:open', clearLegacy); document.addEventListener('canvas:close', clear); return () => { document.removeEventListener('sticky:open', open); document.removeEventListener('sticky:closed', closed); document.removeEventListener('canvas:open', clearLegacy); document.removeEventListener('canvas:close', clear); clear(); style.remove() } }, 'sticky: lifecycle') }
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
    const queue = []; const names = new Map(); let source; let canvasOpen = false; const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); for (const child of children) if (child) node.append(child); return node }; const text = value => document.createTextNode(String(value)); const STYLE_ID = 'dsh-bubble-style'; const CSS = `#bubble-queue{position:absolute;right:18px;top:16px;z-index:5;width:280px;max-height:250px;overflow:hidden;background:#0e1014;color:#d9dde5;border:1px solid #242728;border-radius:10px;box-shadow:0 10px 28px #0009}#bubble-queue[hidden]{display:none}.bubble-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #242728;color:#d9dde5;font-weight:700}.bubble-count{min-width:20px;padding:2px 6px;border-radius:10px;background:#ff5d63;color:#08090a;text-align:center;font-size:11px}.bubble-list{max-height:204px;overflow:auto}.bubble-item{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #1a1e24;background:#0e1014;color:#d9dde5;text-align:left;cursor:pointer;font:12px Inter,ui-sans-serif,system-ui,sans-serif}.bubble-item:hover{background:#15191e}.bubble-agent{display:block;margin-bottom:3px;font-weight:700}.bubble-text{display:block;color:#737d8b;font-size:11px}`
    function render() { let panel = document.getElementById('bubble-queue'); const root = document.getElementById('canvas-root'); if (!root) return; if (!panel || !panel.isConnected) { panel = h('aside', { id: 'bubble-queue' }); root.append(panel) } panel.hidden = !canvasOpen || queue.length === 0; panel.replaceChildren(); const heading = h('header', { className: 'bubble-head' }, text('Notifications'), queue.length ? h('span', { className: 'bubble-count' }, text(queue.length)) : null); panel.append(heading); const list = h('div', { className: 'bubble-list' }); queue.forEach((item, index) => { const button = h('button', { className: 'bubble-item', type: 'button' }, h('span', { className: 'bubble-agent' }, text(item.agentName)), h('span', { className: 'bubble-text' }, text(item.text))); button.onclick = () => { queue.splice(index, 1); document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: item.agentId, unread: false } })); document.dispatchEvent(new CustomEvent('singularity:focus-node', { detail: { agentId: item.agentId } })); render() }; list.append(button) }); panel.append(list) }
    function graph(event) { names.clear(); event.detail.snapshot.agents.forEach(agent => names.set(agent.id, agent.name)); for (const item of queue) document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: item.agentId, unread: true } })) }
    function add(event) { const item = JSON.parse(event.data); if (typeof item.agentId !== 'string' || typeof item.text !== 'string') throw new Error('bubble: notice event is invalid'); const value = { agentId: item.agentId, agentName: names.get(item.agentId) ?? item.agentId, text: item.text }; queue.push(value); document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: value.agentId, unread: true } })); render() }
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
