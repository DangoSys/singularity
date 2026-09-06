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

window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/node',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-node-style'
    const CSS = `.canvas-node{position:absolute;box-sizing:border-box;padding:13px;border:1px solid #9aa8ba;background:#fff;color:#172033;cursor:pointer;box-shadow:0 4px 12px #2330441c;transition:box-shadow .15s,border-color .15s}.canvas-node:hover{border-color:#2563eb;box-shadow:0 7px 18px #2330442b}.canvas-node[data-shape="circle"]{border-radius:50%;display:grid;place-items:center;text-align:center}.canvas-node[data-shape="diamond"]{transform:rotate(45deg);border-radius:6px}.canvas-node[data-shape="diamond"]>*{transform:rotate(-45deg)}.canvas-node-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-node-meta{margin-top:8px;color:#52627a;font-size:12px;display:flex;justify-content:space-between;gap:12px}.canvas-node-report{position:absolute;right:5px;top:5px;width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:#40506a;cursor:pointer}.canvas-node-report:hover{background:#e8edf4}.canvas-node-unread{position:absolute;right:6px;top:6px;width:9px;height:9px;border-radius:50%;background:#dc2626;display:none;box-shadow:0 0 0 2px #fff}.canvas-node[data-unread="true"] .canvas-node-unread{display:block}.canvas-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px;background:#8b96a5}.canvas-dot[data-status="running"]{background:#2563eb}.canvas-dot[data-status="done"]{background:#16834b}.canvas-dot[data-status="failed"]{background:#dc2626}.canvas-group{position:absolute;border:1px solid #8796aa;background:#dce4efcc;border-radius:8px;cursor:pointer}.canvas-group-label{position:absolute;top:7px;left:10px;color:#334155;font-size:12px;font-weight:700}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    function draw(event) { const layer = document.querySelector('.canvas-nodes'); const groups = document.querySelector('.canvas-groups'); if (!layer || !groups) return; layer.replaceChildren(); groups.replaceChildren(); const snapshot = event.detail.snapshot; const byId = new Map(snapshot.agents.map(agent => [agent.id, agent])); snapshot.groups.forEach(group => { const members = group.memberIds.map(id => byId.get(id)); if (members.some(agent => !agent?.node)) throw new Error(`node: group "${group.id}" has agent without node`); const nodes = members.map(agent => agent.node); const x = Math.min(...nodes.map(node => node.x)) - 22; const y = Math.min(...nodes.map(node => node.y)) - 30; const width = Math.max(...nodes.map(node => node.x + node.width)) - x + 22; const height = Math.max(...nodes.map(node => node.y + node.height)) - y + 30; const box = h('div', { className: 'canvas-group', style: `left:${x}px;top:${y}px;width:${width}px;height:${height}px` }, h('div', { className: 'canvas-group-label' }, text(`Group ${group.id}`))); box.onclick = () => document.dispatchEvent(new CustomEvent('singularity:group', { detail: group })); groups.append(box) }); snapshot.agents.forEach(agent => { if (!agent.node) throw new Error(`node: agent "${agent.id}" has no canvas node`); const node = agent.node; const shape = node.shape; const item = h('article', { className: 'canvas-node', dataset: { agentId: agent.id, shape, unread: 'false' }, style: `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px` }, h('span', { className: 'canvas-node-unread' }), h('div', { className: 'canvas-node-name' }, text(agent.name)), h('div', { className: 'canvas-node-meta' }, h('span', {}, h('span', { className: 'canvas-dot', dataset: { status: agent.status } }), text(agent.status)), h('span', {}, text(agent.routerFor ? 'router' : 'agent')))); const report = h('button', { className: 'canvas-node-report', title: 'Open report', 'aria-label': 'Open report' }, text('i')); report.onclick = event => { event.stopPropagation(); document.dispatchEvent(new CustomEvent('singularity:report', { detail: agent })) }; item.append(report); item.onclick = () => { document.dispatchEvent(new CustomEvent('singularity:unread', { detail: { agentId: agent.id, unread: false } })); document.dispatchEvent(new CustomEvent('singularity:agent', { detail: agent })) }; layer.append(item) }) }
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
        line.setAttribute('x1', String(from.x + from.width / 2)); line.setAttribute('y1', String(from.y + from.height / 2)); line.setAttribute('x2', String(to.x + to.width / 2)); line.setAttribute('y2', String(to.y + to.height / 2)); line.setAttribute('stroke', edge.kind === 'handoff' ? '#52647d' : '#9da8b6'); line.setAttribute('stroke-width', edge.kind === 'handoff' ? '2' : '1.4'); line.setAttribute('stroke-dasharray', edge.kind === 'handoff' ? '5 4' : 'none'); layer.append(line)
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
    const CSS = `.sticky{position:fixed;z-index:2147481000;width:360px;height:380px;display:flex;flex-direction:column;background:#fff;color:#172033;border:1px solid #aebacc;border-radius:8px;box-shadow:0 10px 28px #1b26362b}.sticky.min{height:40px;width:240px}.sticky-head{height:40px;flex:none;display:flex;align-items:center;padding:0 8px 0 14px;border-bottom:1px solid #d8e0ea;background:#fff;color:#172033;cursor:move}.sticky-title{min-width:0;flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sticky-actions{display:flex;gap:2px}.sticky-button{width:28px;height:28px;padding:0;border:0;background:none;border-radius:5px;cursor:pointer;color:#40506a;font:inherit}.sticky-button:hover{background:#e8edf4;color:#172033}.sticky-body{min-height:0;flex:1;overflow:auto;color:#172033}`
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
    const queue = []; const names = new Map(); let source; let canvasOpen = false; const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else node.setAttribute(key, value) }); for (const child of children) if (child) node.append(child); return node }; const text = value => document.createTextNode(String(value)); const STYLE_ID = 'dsh-bubble-style'; const CSS = `#bubble-queue{position:absolute;right:18px;top:16px;z-index:5;width:280px;max-height:250px;overflow:hidden;background:#fff;color:#172033;border:1px solid #aebacc;border-radius:8px;box-shadow:0 10px 28px #1b26362b}#bubble-queue[hidden]{display:none}.bubble-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #d8e0ea;color:#172033;font-weight:700}.bubble-count{min-width:20px;padding:2px 6px;border-radius:10px;background:#dc2626;color:#fff;text-align:center;font-size:11px}.bubble-list{max-height:204px;overflow:auto}.bubble-item{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #edf1f5;background:#fff;color:#172033;text-align:left;cursor:pointer;font:13px system-ui}.bubble-item:hover{background:#f1f5f9}.bubble-agent{display:block;margin-bottom:3px;font-weight:700}.bubble-text{display:block;color:#52627a;font-size:12px}`
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
