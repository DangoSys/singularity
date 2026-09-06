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

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/node',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-node-style'
    const CSS = ` .canvas-node{position:absolute;box-sizing:border-box;padding:15px 15px 13px;border:1px solid #46616a;border-radius:13px;background:linear-gradient(145deg,#1d2c33f2,#142127f2);color:#ecf5f1;cursor:pointer;box-shadow:0 14px 28px #050b0e66,0 1px 0 #ffffff0a inset;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.canvas-node:hover{border-color:#9be8c4;box-shadow:0 18px 34px #050b0e8c,0 0 0 4px #9be8c414,0 1px 0 #ffffff12 inset;transform:translateY(-2px)}.canvas-node[data-status="running"]{border-color:#68c69b}.canvas-node[data-status="failed"]{border-color:#b96f5d}.canvas-node[data-shape="circle"]{border-radius:50%;display:grid;place-items:center;text-align:center}.canvas-node[data-shape="diamond"]{transform:rotate(45deg);border-radius:8px}.canvas-node[data-shape="diamond"]>*{transform:rotate(-45deg)}.canvas-node[data-shape="diamond"]:hover{transform:rotate(45deg) translateY(-2px)}.canvas-node-name{padding-right:25px;color:#f3f8f5;font-size:13px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-node-meta{margin-top:10px;color:#91aaa8;font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-transform:uppercase;letter-spacing:.06em}.canvas-node-meta>span:last-child{color:#67817f;font-size:10px}.canvas-node-report{position:absolute;right:8px;top:8px;display:grid;place-items:center;width:22px;height:22px;border:1px solid transparent;border-radius:7px;background:transparent;color:#789492;cursor:pointer;font-size:13px}.canvas-node-report:hover{border-color:#507066;background:#29443b;color:#b8f5d2}.canvas-node-unread{position:absolute;right:9px;top:9px;width:8px;height:8px;border:2px solid #142127;border-radius:50%;background:#f5b762;display:none;box-shadow:0 0 12px #f5b76299}.canvas-node[data-unread="true"] .canvas-node-unread{display:block}.canvas-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;background:#718785;box-shadow:0 0 0 3px #71878518}.canvas-dot[data-status="running"]{background:#83e3b2;box-shadow:0 0 0 3px #83e3b21c,0 0 10px #83e3b288}.canvas-dot[data-status="done"]{background:#8ecbb0}.canvas-dot[data-status="failed"]{background:#f18469}.canvas-group{position:absolute;border:1px dashed #53706f;border-radius:17px;background:#1e373425;cursor:pointer;box-shadow:0 0 0 1px #9be8c408 inset}.canvas-group:hover{border-color:#83e3b2;background:#23423936}.canvas-group-label{position:absolute;top:-11px;left:15px;padding:3px 8px;border:1px solid #46616a;border-radius:6px;background:#142127;color:#9db6b1;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    function draw(event) { const layer = document.querySelector('.canvas-nodes'); const groups = document.querySelector('.canvas-groups'); if (!layer || !groups) return; layer.replaceChildren(); groups.replaceChildren(); const snapshot = event.detail.snapshot; const byId = new Map(snapshot.agents.map(agent => [agent.id, agent])); snapshot.groups.forEach(group => { const members = group.memberIds.map(id => byId.get(id)); if (members.some(agent => !agent?.node)) throw new Error(`node: group "${group.id}" has agent without node`); const nodes = members.map(agent => agent.node); const x = Math.min(...nodes.map(node => node.x)) - 22; const y = Math.min(...nodes.map(node => node.y)) - 30; const width = Math.max(...nodes.map(node => node.x + node.width)) - x + 22; const height = Math.max(...nodes.map(node => node.y + node.height)) - y + 30; const box = h('div', { className: 'canvas-group', style: `left:${x}px;top:${y}px;width:${width}px;height:${height}px` }, h('div', { className: 'canvas-group-label' }, text(`Group ${group.id}`))); box.onclick = () => document.dispatchEvent(new CustomEvent('singularity:group', { detail: group })); groups.append(box) }); snapshot.agents.forEach(agent => { if (!agent.node) throw new Error(`node: agent "${agent.id}" has no canvas node`); const node = agent.node; const shape = node.shape; const item = h('article', { className: 'canvas-node', dataset: { agentId: agent.id, shape, status: agent.status, unread: 'false' }, style: `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px` }, h('span', { className: 'canvas-node-unread' }), h('div', { className: 'canvas-node-name' }, text(agent.name)), h('div', { className: 'canvas-node-meta' }, h('span', {}, h('span', { className: 'canvas-dot', dataset: { status: agent.status } }), text(agent.status)), h('span', {}, text(agent.routerFor ? 'router' : 'agent')))); const report = h('button', { className: 'canvas-node-report', title: 'Open report', 'aria-label': 'Open report' }, text('↗')); report.onclick = event => { event.stopPropagation(); document.dispatchEvent(new CustomEvent('singularity:report', { detail: agent })) }; item.append(report); item.onclick = () => { document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: agent.id, unread: false } })); document.dispatchEvent(new CustomEvent('singularity:agent', { detail: agent })) }; layer.append(item) }) }
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
      const layer = document.querySelector('.canvas-edges')
      if (!layer) return
      layer.replaceChildren()
      const nodes = new Map(event.detail.snapshot.agents.map(agent => [agent.id, agent.node]))
      for (const edge of event.detail.snapshot.edges) {
        const from = nodes.get(edge.from); const to = nodes.get(edge.to)
        if (!from || !to) throw new Error(`connect: edge "${edge.id}" references an agent without node`)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', String(from.x + from.width / 2)); line.setAttribute('y1', String(from.y + from.height / 2)); line.setAttribute('x2', String(to.x + to.width / 2)); line.setAttribute('y2', String(to.y + to.height / 2)); line.setAttribute('stroke', edge.kind === 'handoff' ? '#83e3b2' : '#4b6371'); line.setAttribute('stroke-width', edge.kind === 'handoff' ? '2.2' : '1.5'); line.setAttribute('stroke-dasharray', edge.kind === 'handoff' ? '7 5' : 'none'); layer.append(line)
      }
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
    const CSS = `.sticky{position:fixed;z-index:2147481000;width:380px;height:400px;display:flex;flex-direction:column;background:#17252bdd;color:#e8f0ed;border:1px solid #46616a;border-radius:16px;box-shadow:0 24px 60px #050b0eb8,0 1px 0 #ffffff12 inset;backdrop-filter:blur(18px);overflow:hidden}.sticky.min{height:48px;width:260px}.sticky-head{height:48px;flex:none;display:flex;align-items:center;padding:0 10px 0 17px;border-bottom:1px solid #30434c;background:#1c2d33e6;color:#e8f0ed;cursor:move}.sticky-title{min-width:0;flex:1;font-size:13px;font-weight:700;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sticky-actions{display:flex;gap:3px}.sticky-button{width:28px;height:28px;padding:0;border:1px solid transparent;background:transparent;border-radius:8px;cursor:pointer;color:#8fa5a7;font:inherit;font-size:17px;line-height:1}.sticky-button:hover{border-color:#46616a;background:#29443b;color:#d4f6e2}.sticky-body{min-height:0;flex:1;overflow:auto;color:#d6e3df;scrollbar-color:#38505a transparent}.sticky-body::-webkit-scrollbar{width:9px}.sticky-body::-webkit-scrollbar-thumb{border:3px solid #17252b;border-radius:9px;background:#38505a}`
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
    const queue = []; const names = new Map(); let source; let canvasOpen = false; const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); for (const child of children) if (child) node.append(child); return node }; const text = value => document.createTextNode(String(value)); const STYLE_ID = 'dsh-bubble-style'; const CSS = `#bubble-queue{position:absolute;right:22px;top:84px;z-index:5;width:300px;max-height:270px;overflow:hidden;background:#17252bef;color:#e8f0ed;border:1px solid #46616a;border-radius:15px;box-shadow:0 20px 42px #050b0e99,0 1px 0 #ffffff0d inset;backdrop-filter:blur(16px)}#bubble-queue[hidden]{display:none}.bubble-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid #30434c;color:#e8f0ed;font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.bubble-count{min-width:20px;padding:3px 7px;border:1px solid #d9944c66;border-radius:8px;background:#7a4e2c;color:#ffd6a3;text-align:center;font-size:10px;letter-spacing:0}.bubble-list{max-height:220px;overflow:auto}.bubble-item{display:block;width:100%;padding:12px 15px;border:0;border-bottom:1px solid #30434c;background:transparent;color:#e8f0ed;text-align:left;cursor:pointer;font:13px ui-sans-serif,system-ui,sans-serif}.bubble-item:hover{background:#29443b66}.bubble-agent{display:block;margin-bottom:3px;font-weight:700}.bubble-text{display:block;color:#8fa5a7;font-size:12px;line-height:1.4}`
    function render() { let panel = document.getElementById('bubble-queue'); const root = document.getElementById('canvas-root'); if (!root) return; if (!panel || !panel.isConnected) { panel = h('aside', { id: 'bubble-queue' }); root.append(panel) } panel.hidden = !canvasOpen || queue.length === 0; panel.replaceChildren(); const heading = h('header', { className: 'bubble-head' }, text('通知'), queue.length ? h('span', { className: 'bubble-count' }, text(queue.length)) : null); panel.append(heading); const list = h('div', { className: 'bubble-list' }); queue.forEach((item, index) => { const button = h('button', { className: 'bubble-item', type: 'button' }, h('span', { className: 'bubble-agent' }, text(item.agentName)), h('span', { className: 'bubble-text' }, text(item.text))); button.onclick = () => { queue.splice(index, 1); document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: item.agentId, unread: false } })); document.dispatchEvent(new CustomEvent('singularity:focus-node', { detail: { agentId: item.agentId } })); render() }; list.append(button) }); panel.append(list) }
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
