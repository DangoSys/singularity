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
      if (key.startsWith('chat:') || key.startsWith('session:')) return
      if (windows.has(id)) return
      closeUnlocked()
      const canvas = document.getElementById('canvas-root'); const canvasRect = canvas?.getBoundingClientRect(); const x = event.detail.x ?? (canvasRect ? window.innerWidth - canvasRect.right + 24 + windows.size * 26 : 24 + windows.size * 26); const y = event.detail.y ?? 24 + windows.size * 26
      const node = h('section', { className: 'sticky', style: `right:${x}px;bottom:${y}px` }); const head = h('header', { className: 'sticky-head' }); const label = h('div', { className: 'sticky-title' }); label.textContent = title; const actions = h('div', { className: 'sticky-actions' }); const pin = h('button', { className: 'sticky-button sticky-pin', type: 'button', title: pinned ? 'Unpin' : 'Pin', 'aria-label': pinned ? 'Unpin' : 'Pin' }); pin.textContent = '●'; const min = h('button', { className: 'sticky-button', type: 'button', title: 'Minimize', 'aria-label': 'Minimize' }); min.textContent = '−'; const shut = h('button', { className: 'sticky-button', type: 'button', title: 'Close', 'aria-label': 'Close' }); shut.textContent = '×'; actions.append(pin, min, shut); head.append(label, actions); const content = h('div', { className: 'sticky-body' }); content.append(body); node.append(head, content); document.body.append(node)
      node.dataset.stickyId = key; node.dataset.sessionSticky = String(session); node.dataset.pinned = String(pinned); if (target?.id) node.dataset.targetId = String(target.id)
      const item = { id, node, target, dispose, session, pinned, min: false }; windows.set(id, item); node.onclick = () => select(item); pin.onclick = event => { event.stopPropagation(); item.pinned = !item.pinned; node.dataset.pinned = String(item.pinned); pin.title = item.pinned ? 'Unpin' : 'Pin'; pin.setAttribute('aria-label', pin.title); changed(item); select(item) }; shut.onclick = event => { event.stopPropagation(); close(item) }; min.onclick = event => { event.stopPropagation(); item.min = !item.min; node.classList.toggle('min', item.min); changed(item) }
      let drag; label.onpointerdown = pointer => { drag = { x: pointer.clientX, y: pointer.clientY, right: x, bottom: y }; label.setPointerCapture?.(pointer.pointerId); select(item) }; head.onpointermove = pointer => { if (!drag) return; node.style.right = `${drag.right - pointer.clientX + drag.x}px`; node.style.bottom = `${drag.bottom - pointer.clientY + drag.y}px`; changed(item) }; head.onpointerup = () => { drag = undefined; changed(item) }
      select(item)
    }
    function clear() { for (const item of [...windows.values()]) close(item) }
    function clearLegacy() { for (const item of [...windows.values()]) { const key = String(item.id); if (item.session || key.startsWith('chat:') || key.startsWith('session:')) close(item) } }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); clearLegacy(); document.addEventListener('sticky:open', open); document.addEventListener('sticky:closed', closed); document.addEventListener('canvas:open', clearLegacy); document.addEventListener('canvas:close', clear); return () => { document.removeEventListener('sticky:open', open); document.removeEventListener('sticky:closed', closed); document.removeEventListener('canvas:open', clearLegacy); document.removeEventListener('canvas:close', clear); clear(); style.remove() } }, 'sticky: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})
