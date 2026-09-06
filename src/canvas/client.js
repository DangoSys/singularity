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
