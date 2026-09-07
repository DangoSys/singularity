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
