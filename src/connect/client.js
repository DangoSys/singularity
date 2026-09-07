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
