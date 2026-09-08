window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity-canvas-edge',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-connect-style'
    const CSS = `.canvas-edges path{fill:none;stroke:color-mix(in srgb,var(--singularity-border,#dbe3ee) 86%,transparent);stroke-width:1.25;opacity:.55;vector-effect:non-scaling-stroke}.canvas-edges path[data-kind="handoff"]{stroke:color-mix(in srgb,var(--singularity-blue,#3b82f6) 56%,var(--singularity-border,#dbe3ee));stroke-dasharray:5 4}.canvas-edges path[data-selected="true"]{stroke:var(--singularity-blue,#3b82f6);stroke-width:2.5;opacity:1}.canvas-pr-bot-overlay{position:fixed;inset:0;z-index:2147480999;width:100%;height:100%;pointer-events:none;overflow:visible}.canvas-pr-bot-path{fill:none;stroke-width:2.5;stroke-linecap:round;vector-effect:non-scaling-stroke}.canvas-pr-bot-path[data-path="pr"]{stroke:var(--singularity-blue,#3b82f6)}.canvas-pr-bot-path[data-path="bot"]{stroke:#7c3aed;stroke-dasharray:5 4}.canvas-pr-bot-endpoint[data-path="pr"]{fill:var(--singularity-blue,#3b82f6)}.canvas-pr-bot-endpoint[data-path="bot"]{fill:#7c3aed}.canvas-pr-bot-ring{fill:none;stroke:#7c3aed;stroke-width:1.5;opacity:.35}`
    let lastEvent
    let selectedAgentId
    const markers = []
    const sent = new Set()
    function point(node) { return { x: node.offsetLeft + node.offsetWidth / 2, y: node.offsetTop + node.offsetHeight / 2 } }
    function path(from, to) { const dx = to.x - from.x; const bend = Math.max(34, Math.abs(dx) * .28); return `M ${from.x} ${from.y} C ${from.x + (dx >= 0 ? bend : -bend)} ${from.y}, ${to.x - (dx >= 0 ? bend : -bend)} ${to.y}, ${to.x} ${to.y}` }
    function composer() { return document.querySelector('[data-singularity-composer]') }
    function key(event) {
      if (!event || (event.path !== "pr" && event.path !== "bot")) throw new Error("connect: pr-chat event has an invalid path")
      if (event.path === "bot" && event.target && typeof event.target.sessionId === "string" && event.target.sessionId.length > 0) return `bot:${event.target.sessionId}`
      if (event.path === "pr" && event.target && typeof event.target.repo === "string" && event.target.repo.length > 0 && Number.isSafeInteger(event.target.number) && event.target.number > 0) return `pr:${event.target.repo}#${event.target.number}`
      throw new Error("connect: pr-chat event has an invalid target")
    }
    function targetFor(marker) {
      if (marker.path === 'bot') return [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === marker.target.sessionId)
      const targetKey = `${marker.target.repo}#${marker.target.number}`
      const explicit = [...document.querySelectorAll('[data-singularity-pr-target]')].find(node => node.dataset.singularityPrTarget === targetKey)
      if (explicit) return explicit
      return undefined
    }
    function svg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag) }
    function drawMarkers() {
      document.querySelector('.canvas-pr-bot-overlay')?.remove()
      if (markers.length === 0 && sent.size === 0) return
      const source = composer()
      if (!source) return
      const sourceRect = source.getBoundingClientRect()
      const from = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 }
      const overlay = svg('svg'); overlay.classList.add('canvas-pr-bot-overlay'); overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)
      for (const marker of markers) {
        if (!marker.hasPath) continue
        const target = targetFor(marker); if (!target) continue
        const rect = target.getBoundingClientRect(); const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        const line = svg('path'); line.classList.add('canvas-pr-bot-path'); line.dataset.path = marker.path; line.setAttribute('d', path(from, to)); overlay.append(line)
        const endpoint = svg('circle'); endpoint.classList.add('canvas-pr-bot-endpoint'); endpoint.dataset.path = marker.path; endpoint.setAttribute('cx', String(to.x)); endpoint.setAttribute('cy', String(to.y)); endpoint.setAttribute('r', '4'); overlay.append(endpoint)
      }
      for (const marker of markers) {
        const markerKey = key(marker); if (!markerKey || !sent.has(markerKey)) continue
        const target = targetFor(marker); if (!target) continue
        const rect = target.getBoundingClientRect(); const ring = svg('circle'); ring.classList.add('canvas-pr-bot-ring'); ring.setAttribute('cx', String(rect.left + rect.width / 2)); ring.setAttribute('cy', String(rect.top + rect.height / 2)); ring.setAttribute('r', '10'); overlay.append(ring)
      }
      if (overlay.childNodes.length > 0) document.body.append(overlay)
    }
    function receivePath(event) {
      const detail = event.detail
      const markerKey = key(detail)
      const existing = markers.find(marker => key(marker) === markerKey)
      if (existing) existing.hasPath = true
      else markers.push({ path: detail.path, target: detail.target, hasPath: true })
      drawMarkers()
    }
    function receiveSent(event) {
      const detail = event.detail
      const markerKey = key(detail)
      sent.add(markerKey)
      if (!markers.some(marker => key(marker) === markerKey)) markers.push({ path: detail.path, target: detail.target, hasPath: false })
      drawMarkers()
    }
    function draw(event) {
      lastEvent = event
      const layer = document.querySelector('.canvas-edges'); if (!layer) throw new Error('connect: edge layer is not mounted'); const origin = event.detail.origin; if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error('connect: graph origin is invalid')
      layer.replaceChildren(); const byId = new Map(event.detail.snapshot.agents.map(agent => [agent.id, agent])); const edges = new Map(event.detail.snapshot.edges.map(edge => [edge.to, edge]))
      const selectedPath = new Set()
      if (selectedAgentId !== undefined) {
        let id = selectedAgentId
        while (id !== undefined) {
          selectedPath.add(id)
          id = edges.get(id)?.from
        }
      }
      for (const agent of event.detail.snapshot.agents) { const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === agent.id); if (!item) throw new Error('connect: agent ' + agent.id + ' has no rendered node'); const target = point(item); const edge = edges.get(agent.id); const from = edge ? [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === edge.from) : undefined; const start = from ? point(from) : origin; const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path'); curve.setAttribute('d', path(start, target)); curve.dataset.to = agent.id; if (edge) curve.dataset.kind = edge.kind; if (edge && !byId.has(edge.from)) throw new Error('connect: edge ' + edge.id + ' references an unknown source'); if (selectedPath.has(agent.id)) curve.dataset.selected = 'true'; layer.append(curve) }
      drawMarkers()
    }
    function select(event) { const agentId = event.detail?.agentId; if (agentId === undefined) throw new Error('connect: node selection has no agentId'); selectedAgentId = agentId; if (lastEvent) draw(lastEvent) }
    function apply(ctx) { ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:node-selected', select); document.addEventListener('singularity:pr-chat/path', receivePath); document.addEventListener('singularity:pr-chat/sent', receiveSent); window.addEventListener('resize', drawMarkers); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:node-selected', select); document.removeEventListener('singularity:pr-chat/path', receivePath); document.removeEventListener('singularity:pr-chat/sent', receiveSent); window.removeEventListener('resize', drawMarkers); document.querySelector('.canvas-pr-bot-overlay')?.remove(); lastEvent = undefined; selectedAgentId = undefined; markers.length = 0; sent.clear(); style.remove() } }, 'connect: lifecycle') }
    module.exports.apply = apply
    return module.exports
  },
})
