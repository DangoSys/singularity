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
