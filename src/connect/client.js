window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/connect',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-connect-style'
    const CSS = `.canvas-edges path{fill:none;stroke:color-mix(in srgb,var(--singularity-border,#dbe3ee) 86%,transparent);stroke-width:1.25;vector-effect:non-scaling-stroke}.canvas-edges path[data-kind="handoff"]{stroke:color-mix(in srgb,var(--singularity-blue,#3b82f6) 56%,var(--singularity-border,#dbe3ee));stroke-dasharray:5 4}.canvas-composer-overlay{position:fixed;inset:0;z-index:2147480999;pointer-events:none}.canvas-composer-link{fill:none;stroke:var(--singularity-blue,#3b82f6);stroke-width:2;stroke-linecap:round;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--singularity-blue,#3b82f6) 72%,transparent));animation:singularity-composer-pulse 1.8s ease-in-out infinite}@keyframes singularity-composer-pulse{0%,100%{opacity:.55}50%{opacity:1}}`
    let lastEvent
    let selectedAgentId
    function point(node) { return { x: node.offsetLeft + node.offsetWidth / 2, y: node.offsetTop + node.offsetHeight / 2 } }
    function path(from, to) { const dx = to.x - from.x; const bend = Math.max(34, Math.abs(dx) * .28); return `M ${from.x} ${from.y} C ${from.x + (dx >= 0 ? bend : -bend)} ${from.y}, ${to.x - (dx >= 0 ? bend : -bend)} ${to.y}, ${to.x} ${to.y}` }
    function composer() { return document.querySelector('[data-singularity-composer]') }
    function drawComposerLink() {
      document.querySelector('.canvas-composer-overlay')?.remove()
      if (selectedAgentId === undefined) return
      const selected = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === selectedAgentId); const target = composer()
      if (!selected || !target) return
      const root = document.querySelector('.canvas-root'); if (!root) throw new Error('connect: canvas root is not mounted')
      const nodeRect = selected.getBoundingClientRect(); const targetRect = target.getBoundingClientRect()
      const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); overlay.classList.add('canvas-composer-overlay'); overlay.setAttribute('aria-hidden', 'true')
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); line.classList.add('canvas-composer-link'); line.setAttribute('d', path({ x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 }, { x: nodeRect.left + nodeRect.width / 2, y: nodeRect.top + nodeRect.height / 2 })); overlay.append(line); document.body.append(overlay)
    }
    function draw(event) {
      lastEvent = event
      const layer = document.querySelector(".canvas-edges"); if (!layer) throw new Error("connect: edge layer is not mounted"); const origin = event.detail.origin; if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error("connect: graph origin is invalid")
      layer.replaceChildren(); const byId = new Map(event.detail.snapshot.agents.map(agent => [agent.id, agent])); const edges = new Map(event.detail.snapshot.edges.map(edge => [edge.to, edge]))
      for (const agent of event.detail.snapshot.agents) { const item = [...document.querySelectorAll(".canvas-node")].find(node => node.dataset.agentId === agent.id); if (!item) throw new Error("connect: agent " + agent.id + " has no rendered node"); const target = point(item); const edge = edges.get(agent.id); const from = edge ? [...document.querySelectorAll(".canvas-node")].find(node => node.dataset.agentId === edge.from) : undefined; const start = from ? point(from) : origin; const curve = document.createElementNS("http://www.w3.org/2000/svg", "path"); curve.setAttribute("d", path(start, target)); if (edge) curve.dataset.kind = edge.kind; if (edge && !byId.has(edge.from)) throw new Error("connect: edge " + edge.id + " references an unknown source"); layer.append(curve) }
      drawComposerLink()
    }
    function select(event) { const agentId = event.detail?.agentId; if (agentId === undefined) throw new Error('connect: node selection has no agentId'); selectedAgentId = agentId; if (lastEvent) draw(lastEvent) }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:node-selected', select); window.addEventListener('resize', drawComposerLink); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:node-selected', select); window.removeEventListener('resize', drawComposerLink); document.querySelector('.canvas-composer-overlay')?.remove(); lastEvent = undefined; selectedAgentId = undefined; style.remove() } }, 'connect: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})
