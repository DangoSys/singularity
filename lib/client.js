window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/canvas',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const createElement = React.createElement
    const GRAPH = '/singular/graph'
    const EVENTS = '/singular/events'
    const STYLE_ID = 'dsh-canvas-style'
    const CSS = `.canvas-launch{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:calc(100% + 8px);height:34px;margin:4px -4px;padding:6px 2px 6px 10px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;overflow:hidden}.canvas-launch:hover,.canvas-launch[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)}.canvas-launch.rail{justify-content:center;width:36px;height:36px;margin:8px 0 10px;padding:0;border-radius:50%}.canvas-launch svg{width:18px;height:18px;flex:none}.canvas-launch-label{white-space:nowrap;overflow:hidden}.canvas-root{position:fixed;z-index:2130000000;overflow:hidden;background:#eef1f5;color:#172033;font:13px system-ui,sans-serif;color-scheme:light}.canvas-head{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid #cbd3df;background:#fff;color:#172033}.canvas-title{font-size:16px;font-weight:700;letter-spacing:0}.canvas-error{margin-left:auto;max-width:55%;color:#b42318;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-close{width:32px;height:32px;border:1px solid transparent;border-radius:6px;background:transparent;color:#40506a;cursor:pointer;font:inherit}.canvas-close:hover{background:#e8edf4;color:#172033}.canvas-surface{position:absolute;inset:52px 0 0;overflow:auto;background:#e8edf3}.canvas-plane{position:relative;background:#f7f9fb;background-image:linear-gradient(#dfe5ed 1px,transparent 1px),linear-gradient(90deg,#dfe5ed 1px,transparent 1px);background-size:24px 24px}.canvas-layer{position:absolute;inset:0}.canvas-status{padding:24px;color:#40506a;font-weight:600}`
    const state = { open: false, snapshot: null, error: '', source: null, extent: { left: 360, top: 240, right: 1800, bottom: 1100 }, surface: null, plane: null, root: null, resize: null }
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(props)) { if (key === 'className') node.className = value; else if (key === 'ariaLabel') node.setAttribute('aria-label', value); else node.setAttribute(key, value) } for (const child of children) if (child) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }))
    function validate(value) {
      if (!value || typeof value !== 'object' || value.version !== 1 || typeof value.id !== 'string' || !Array.isArray(value.roots) || !Array.isArray(value.agents) || !Array.isArray(value.groups) || !Array.isArray(value.edges)) throw new Error('canvas: graph snapshot is invalid')
      for (const agent of value.agents) { if (!agent || typeof agent.id !== 'string' || typeof agent.name !== 'string' || typeof agent.status !== 'string') throw new Error('canvas: graph agent is invalid'); const node = agent.node; if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || node.width <= 0 || !Number.isFinite(node.height) || node.height <= 0 || !['card', 'circle', 'diamond'].includes(node.shape)) throw new Error(`canvas: agent "${agent.id}" has no valid node geometry`) }
      return value
    }
    async function load() { const response = await fetch(GRAPH); const raw = await response.text(); if (!response.ok) throw new Error(raw); let value; try { value = JSON.parse(raw) } catch (error) { throw new Error(`canvas: graph returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`) } state.snapshot = validate(value) }
    function detail() { return { snapshot: state.snapshot, plane: state.plane, offsetX: state.extent.left, offsetY: state.extent.top } }
    function publish() { if (state.snapshot) emit('canvas:graph', detail()) }
    function syncLayout() {
      if (!state.root) return
      const center = document.querySelector('[class*="centerCol"]')
      if (!center) throw new Error('canvas: center column is not mounted')
      const rect = center.getBoundingClientRect()
      Object.assign(state.root.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    }
    function connect() { state.source?.close(); const source = new EventSource(EVENTS); state.source = source; source.addEventListener('graph', event => { try { state.snapshot = validate(JSON.parse(event.data)); state.error = ''; render(); publish() } catch (error) { fail(error) } }); source.onerror = () => { source.close(); state.source = null; if (state.open) fail('canvas: event stream closed') } }
    function fail(error) { state.snapshot = null; state.error = error instanceof Error ? error.message : String(error); render() }
    function grow(direction) { if (!state.surface || !state.plane) throw new Error('canvas: viewport is not mounted'); if (direction === 'left') state.extent.left += 600; else if (direction === 'right') state.extent.right += 600; else if (direction === 'up') state.extent.top += 500; else if (direction === 'down') state.extent.bottom += 500; else throw new Error(`canvas: unknown expansion direction "${direction}"`); render(); if (direction === 'left') state.surface.scrollLeft = 0; if (direction === 'up') state.surface.scrollTop = 0 }
    function expand(event) { const direction = event.detail?.direction; if (typeof direction !== 'string') throw new Error('canvas: expansion direction is required'); grow(direction) }
    function openCanvas() { state.open = true; state.error = ''; render(); load().then(() => { connect(); render(); publish() }).catch(fail) }
    function closeCanvas() { state.open = false; state.source?.close(); state.source = null; state.resize?.disconnect(); state.resize = null; emit('canvas:close', {}); render() }
    function focusNode(event) {
      if (!state.snapshot || !state.surface) throw new Error('canvas: cannot focus a node before the graph is mounted')
      const agent = state.snapshot.agents.find(item => item.id === event.detail.agentId)
      if (!agent?.node) throw new Error(`canvas: agent "${event.detail.agentId}" is not in the current graph`)
      const node = agent.node
      state.surface.scrollTo({ left: state.extent.left + node.x + node.width / 2 - state.surface.clientWidth / 2, top: state.extent.top + node.y + node.height / 2 - state.surface.clientHeight / 2, behavior: 'smooth' })
      const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === agent.id)
      item?.classList.add('canvas-node-focus')
      window.setTimeout(() => item?.classList.remove('canvas-node-focus'), 1100)
    }
    function icon() { return createElement('svg', { viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': true }, createElement('circle', { cx: 5, cy: 5, r: 2, stroke: 'currentColor', strokeWidth: 1.3 }), createElement('circle', { cx: 13, cy: 5, r: 2, stroke: 'currentColor', strokeWidth: 1.3 }), createElement('circle', { cx: 9, cy: 13, r: 2, stroke: 'currentColor', strokeWidth: 1.3 }), createElement('path', { d: 'm6.7 6.2 1.1 4.1m3.5-4.1-1.1 4.1M7 5h4', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' })) }
    function Entry({ wide }) { return createElement('button', { type: 'button', className: `canvas-launch${wide ? '' : ' rail'}`, title: 'Singularity Mode', 'aria-label': 'Singularity Mode', 'aria-expanded': state.open, 'aria-controls': 'canvas-root', onClick: openCanvas }, icon(), wide && createElement('span', { className: 'canvas-launch-label' }, 'Singularity Mode')) }
    function mount() { const surface = h('div', { className: 'canvas-surface' }); const plane = h('div', { className: 'canvas-plane' }); plane.append(h('div', { className: 'canvas-layer canvas-groups' }), h('svg', { className: 'canvas-layer canvas-edges', width: '100%', height: '100%' }), h('div', { className: 'canvas-layer canvas-nodes' })); surface.append(plane); state.surface = surface; state.plane = plane; return surface }
    function render() {
      let root = document.getElementById('canvas-root')
      if (!state.open) { root?.remove(); state.surface = null; state.plane = null; state.root = null; return }
      if (!root) { root = h('main', { id: 'canvas-root', className: 'canvas-root' }); document.body.append(root); state.root = root; state.resize = new ResizeObserver(syncLayout); const center = document.querySelector('[class*="centerCol"]'); if (!center) throw new Error('canvas: center column is not mounted'); state.resize.observe(center); window.addEventListener('resize', syncLayout) }
      syncLayout()
      if (!state.surface) root.append(h('header', { className: 'canvas-head' }, h('div', { className: 'canvas-title' }, text('Singularity Mode')), state.error && h('div', { className: 'canvas-error' }, text(state.error)), (() => { const button = h('button', { className: 'canvas-close', title: 'Close', ariaLabel: 'Close' }, text('×')); button.onclick = closeCanvas; return button })()), mount())
      const width = state.extent.left + state.extent.right; const height = state.extent.top + state.extent.bottom; state.plane.style.width = `${width}px`; state.plane.style.height = `${height}px`; state.plane.querySelectorAll('.canvas-layer').forEach(layer => { layer.style.transform = `translate(${state.extent.left}px,${state.extent.top}px)` }); if (!state.snapshot) { state.plane.querySelectorAll('.canvas-layer').forEach(layer => layer.replaceChildren()); state.surface.querySelector('.canvas-status')?.remove(); state.surface.append(h('div', { className: 'canvas-status' }, text(state.error || 'Loading graph...'))); return } state.surface.querySelector('.canvas-status')?.remove(); emit('canvas:open', detail()); publish()
    }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = `${CSS}.canvas-node-focus{outline:3px solid #2563eb;outline-offset:4px;}`; document.head.append(style); const openDetails = () => ctx.layout.openDetails(); const closeDetails = () => ctx.layout.closeDetails(); document.addEventListener('singularity:focus-node', focusNode); document.addEventListener('canvas:expand', expand); document.addEventListener('canvas:open', openDetails); document.addEventListener('canvas:close', closeDetails); return () => { document.removeEventListener('singularity:focus-node', focusNode); document.removeEventListener('canvas:expand', expand); document.removeEventListener('canvas:open', openDetails); document.removeEventListener('canvas:close', closeDetails); window.removeEventListener('resize', syncLayout); closeCanvas(); style.remove() } }, 'canvas: styles'); ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'canvas', order: -10 }, Entry)) }
    module.exports.apply = apply
    module.exports.inject = ['slots', 'layout']
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
    let targetId
    let targetStickyId
    let edgeLayer
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
    function ensureTargetLayer() { if (edgeLayer) return edgeLayer; edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); edgeLayer.classList.add('canvas-target-edge'); Object.assign(edgeLayer.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '2147480000', pointerEvents: 'none', overflow: 'visible' }); document.body.append(edgeLayer); return edgeLayer }
    function drawTarget() {
      if (!edgeLayer) return
      edgeLayer.replaceChildren()
      if (!targetId || !targetStickyId) return
      const anchor = document.querySelector('.canvas-chat-anchor')
      const sticky = [...document.querySelectorAll('.sticky')].find(node => node.dataset.stickyId === String(targetStickyId))
      if (!anchor || !sticky) return
      const from = anchor.getBoundingClientRect(); const to = sticky.getBoundingClientRect(); const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(from.right)); line.setAttribute('y1', String(from.top + from.height / 2)); line.setAttribute('x2', String(to.left + to.width / 2)); line.setAttribute('y2', String(to.top + to.height / 2)); line.setAttribute('stroke', '#64748b'); line.setAttribute('stroke-width', '1.5'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', '0.8'); edgeLayer.append(line)
    }
    function target(event) { targetId = event.detail?.target?.id; targetStickyId = event.detail?.id; ensureTargetLayer(); drawTarget() }
    function clearTarget(event) { if (!targetStickyId || event.detail?.id === targetStickyId) { targetId = undefined; targetStickyId = undefined; drawTarget() } }
    function changed() { drawTarget() }
    function opened() { ensureTargetLayer(); drawTarget() }
    function closed() { targetId = undefined; targetStickyId = undefined; edgeLayer?.remove(); edgeLayer = undefined }
    function apply(ctx) { ctx.effect(() => { document.addEventListener('canvas:graph', draw); document.addEventListener('canvas:open', opened); document.addEventListener('sticky:selected', target); document.addEventListener('sticky:closed', clearTarget); document.addEventListener('sticky:changed', changed); document.addEventListener('canvas:close', closed); window.addEventListener('resize', changed); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('canvas:open', opened); document.removeEventListener('sticky:selected', target); document.removeEventListener('sticky:closed', clearTarget); document.removeEventListener('sticky:changed', changed); document.removeEventListener('canvas:close', closed); window.removeEventListener('resize', changed); closed() } }, 'connect: lifecycle') }
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
  factory: () => {
    const module = { exports: {} }
    const API = '/singular/chat'; const SEND = '/singular/message'; const STYLE_ID = 'dsh-chat-style'
    const CSS = `.canvas-chat{position:absolute;left:20px;bottom:20px;z-index:4;width:min(430px,calc(100% - 40px));box-sizing:border-box;padding:12px;border:1px solid #aebacc;border-radius:8px;background:#fffffff2;color:#172033;box-shadow:0 12px 28px #23304426;backdrop-filter:blur(10px)}.canvas-chat-anchor{position:absolute;right:-1px;top:50%;width:2px;height:2px}.canvas-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;color:#52627a;font-size:12px;font-weight:650}.canvas-chat-target{min-width:0;overflow:hidden;color:#172033;font-size:13px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.canvas-chat-form,.chat-session-form{display:flex;align-items:flex-end;gap:8px}.canvas-chat textarea,.chat-session-form textarea{box-sizing:border-box;min-width:0;flex:1;resize:none;border:1px solid #aebacc;border-radius:6px;padding:9px 10px;background:#fff;color:#172033;font:13px system-ui;line-height:1.4}.canvas-chat textarea{height:50px}.canvas-chat textarea:disabled{background:#f1f5f9;color:#7a8799}.canvas-chat textarea::placeholder,.chat-session-form textarea::placeholder{color:#7a8799}.canvas-chat button,.chat-session-form button{width:34px;height:34px;flex:none;border:0;border-radius:6px;background:#35557d;color:#fff;cursor:pointer;font:18px system-ui}.canvas-chat button:disabled{background:#aebacc;cursor:default}.chat-session{display:flex;flex-direction:column;height:100%;min-height:0}.chat-session-log{min-height:0;flex:1;overflow:auto;padding:12px;background:#f8fafc}.chat-line{margin:0 0 8px;padding:9px 10px;border:1px solid #dbe3ed;border-radius:7px;background:#fff;color:#172033;white-space:pre-wrap;word-break:break-word;line-height:1.45}.chat-line[data-kind="agent"]{border-left:3px solid #35557d}.chat-session-form{padding:10px 12px;border-top:1px solid #d8e0ea;background:#fff}.chat-session-form textarea{height:48px}.chat-error{padding:7px 10px;color:#b42318;font-size:12px}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) if (child) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    const messageText = item => { const message = item.type === 'assistant/message' ? item.data.message : item.data; if (!Array.isArray(message.content)) throw new Error(`chat: message "${message.id}" has no content`); return message.content.map(block => block.type === 'text' ? block.text : JSON.stringify(block)).join('') }
    const targetId = target => target.group?.routerId ?? target.routerId ?? target.id
    const queryOf = target => target.group ? `group=${encodeURIComponent(target.group.id)}` : target.routerId ? `group=${encodeURIComponent(target.id)}` : `agent=${encodeURIComponent(target.id)}`
    const sessions = new Map(); let target; let dock; let dockTarget; let dockInput; let dockSend
    function line(item) { const row = h('div', { className: 'chat-line', dataset: { kind: item.type === 'assistant/message' ? 'agent' : 'human' } }); row.textContent = messageText(item); return row }
    async function send(target, input) { const value = input.value.trim(); if (!value) return; input.value = ''; const response = await fetch(SEND, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: targetId(target), content: [{ type: 'text', text: value }] }) }); if (!response.ok) throw new Error(await response.text()) }
    function updateDock() { dockTarget.textContent = target ? target.name ?? `Session ${target.id}` : 'Select an agent or group'; dockInput.disabled = !target; dockSend.disabled = !target; dockInput.placeholder = target ? `Message ${target.name ?? target.id}...` : 'Select an agent or group on the canvas' }
    function ensureDock() {
      if (dock) return
      const root = document.getElementById('canvas-root'); if (!root) throw new Error('chat: canvas is not open')
      dockTarget = h('div', { className: 'canvas-chat-target' }); const head = h('header', { className: 'canvas-chat-head' }, text('Send to'), dockTarget); dockInput = h('textarea', { rows: 2 }); dockSend = h('button', { type: 'submit', title: 'Send', 'aria-label': 'Send' }); dockSend.textContent = '↑'; const form = h('form', { className: 'canvas-chat-form' }, dockInput, dockSend); form.onsubmit = async event => { event.preventDefault(); await send(target, dockInput) }; dock = h('section', { className: 'canvas-chat' }, head, form, h('span', { className: 'canvas-chat-anchor' })); root.append(dock); updateDock()
    }
    function createSession(next) {
      const id = `${next.group ? 'group' : 'agent'}:${next.group?.id ?? next.id}`
      if (sessions.has(id)) return id
      const log = h('div', { className: 'chat-session-log' }); const input = h('textarea', { rows: 2, placeholder: `Message ${next.name ?? next.id}...` }); const submit = h('button', { type: 'submit', title: 'Send', 'aria-label': 'Send' }); submit.textContent = '↑'; const form = h('form', { className: 'chat-session-form' }, input, submit); const body = h('div', { className: 'chat-session' }, log, form); const record = { target: next, source: null, log, session: true }; form.onsubmit = async event => { event.preventDefault(); await send(next, input) }; document.dispatchEvent(new CustomEvent('sticky:open', { detail: { id, title: next.name ?? `Session ${next.id}`, body, target: next, session: true, dispose: () => record.source?.close() } })); record.source = new EventSource(`${API}?${queryOf(next)}`); record.source.addEventListener('message', frame => { const item = JSON.parse(frame.data); log.append(line(item)); log.scrollTop = log.scrollHeight }); record.source.onerror = () => { record.source.close(); record.source = null; log.append(h('div', { className: 'chat-error' }, text('chat stream closed'))) }; sessions.set(id, record); return id
    }
    function activate(next, id = createSession(next)) { ensureDock(); target = next; updateDock(); document.dispatchEvent(new CustomEvent('singularity:chat-target', { detail: { target: next, id: next.id, stickyId: id } })) }
    function agent(event) { activate(event.detail) }
    function group(event) { activate({ ...event.detail, group: event.detail }) }
    function sticky(event) { if (event.detail.target) activate(event.detail.target, event.detail.id) }
    function closed(event) { const record = sessions.get(event.detail.id); if (!record) return; record.source?.close(); sessions.delete(event.detail.id); if (event.detail.id === `${target?.group ? 'group' : 'agent'}:${target?.group?.id ?? target?.id}`) { target = undefined; updateDock(); document.dispatchEvent(new CustomEvent('singularity:chat-target', { detail: {} })) } }
    function canvasOpen() { ensureDock() }
    function canvasClosed() { for (const record of sessions.values()) record.source?.close(); sessions.clear(); target = undefined; dock?.remove(); dock = undefined; dockTarget = undefined; dockInput = undefined; dockSend = undefined }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.querySelectorAll('.canvas-chat').forEach(node => node.remove()); document.addEventListener('singularity:agent', agent); document.addEventListener('singularity:group', group); document.addEventListener('sticky:selected', sticky); document.addEventListener('sticky:closed', closed); document.addEventListener('canvas:open', canvasOpen); document.addEventListener('canvas:close', canvasClosed); return () => { document.removeEventListener('singularity:agent', agent); document.removeEventListener('singularity:group', group); document.removeEventListener('sticky:selected', sticky); document.removeEventListener('sticky:closed', closed); document.removeEventListener('canvas:open', canvasOpen); document.removeEventListener('canvas:close', canvasClosed); canvasClosed(); style.remove() } }, 'chat: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
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
    module.exports.inject = ['slots', 'layout']
    return module.exports
  },
})
