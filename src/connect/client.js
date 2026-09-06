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
