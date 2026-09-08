window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity/node',
  factory: () => {
    const module = { exports: {} }
    const STYLE_ID = 'dsh-node-style'
    const CSS = `.canvas-node{position:absolute;z-index:2;box-sizing:border-box;width:134px;height:46px;padding:9px 11px;border:1px solid var(--singularity-border,#dbe3ee);border-radius:10px;background:var(--singularity-surface,#fff);color:var(--singularity-text,#1f2937);cursor:pointer;box-shadow:0 6px 22px color-mix(in srgb,var(--singularity-text,#1f2937) 10%,transparent);transition:border-color .15s,box-shadow .15s,transform .15s;animation:singularity-node-grow .24s ease-out}.canvas-node:hover,.canvas-node[data-selected="true"]{border-color:var(--singularity-blue,#3b82f6);box-shadow:0 8px 28px color-mix(in srgb,var(--singularity-blue,#3b82f6) 24%,transparent)}.canvas-node[data-selected="true"]{transform:translateY(-1px)}.canvas-node[data-status="running"]{border-color:color-mix(in srgb,var(--singularity-blue,#3b82f6) 58%,var(--singularity-border,#dbe3ee))}.canvas-node[data-status="failed"]{border-color:#ef4444}.canvas-node-name{font-weight:700;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.canvas-node-meta{margin-top:4px;color:var(--singularity-muted,#64748b);font-size:10px;display:flex;justify-content:space-between;gap:12px}.canvas-node-report{position:absolute;right:5px;top:5px;width:18px;height:18px;border:0;border-radius:5px;background:transparent;color:var(--singularity-muted,#64748b);cursor:pointer}.canvas-node-report:hover{background:var(--singularity-surface-muted,#f1f5f9);color:var(--singularity-text,#1f2937)}.canvas-node-unread{position:absolute;right:6px;top:6px;width:6px;height:6px;border-radius:50%;background:#ef4444;display:none;box-shadow:0 0 0 2px var(--singularity-surface,#fff)}.canvas-node[data-unread="true"] .canvas-node-unread{display:block}.canvas-dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:5px;background:var(--singularity-muted,#64748b)}.canvas-dot[data-status="running"]{background:var(--singularity-blue,#3b82f6)}.canvas-dot[data-status="done"]{background:var(--singularity-green,#10b981)}.canvas-dot[data-status="failed"]{background:#ef4444}.canvas-dot[data-status="waiting"]{background:#f59e0b}.canvas-dot[data-status="idle"]{background:var(--singularity-muted,#64748b)}.canvas-group{position:absolute;z-index:1;border:1px solid var(--singularity-border,#dbe3ee);background:color-mix(in srgb,var(--singularity-surface,#fff) 66%,transparent);border-radius:12px;cursor:pointer}.canvas-group-label{position:absolute;top:8px;left:10px;color:var(--singularity-muted,#64748b);font-size:10px;font-weight:700}.canvas-inspector{position:absolute;z-index:4;right:19px;top:19px;width:224px;box-sizing:border-box;padding:12px;border:1px solid var(--singularity-border,#dbe3ee);border-radius:12px;background:var(--singularity-surface,#fff);color:var(--singularity-text,#1f2937);box-shadow:0 8px 24px color-mix(in srgb,var(--singularity-text,#1f2937) 18%,transparent)}.canvas-inspector-title{font-weight:700;font-size:12px}.canvas-inspector-subtitle{margin-top:6px;color:var(--singularity-muted,#64748b);font-size:10px}.canvas-session-transcript{padding:10px 12px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;min-height:100%}.canvas-session-message{display:flex;flex-direction:column;gap:3px}.canvas-session-role{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--singularity-muted,#64748b)}.canvas-session-message[data-role="user"] .canvas-session-role{color:var(--singularity-blue,#3b82f6)}.canvas-session-text{font-size:12px;line-height:16px;white-space:pre-wrap;word-break:break-word;color:var(--singularity-text,#1f2937)}.canvas-session-empty{padding:10px 12px;color:var(--singularity-muted,#64748b);font-size:11px}@keyframes singularity-node-grow{from{opacity:0;transform:scale(.84)}to{opacity:1;transform:scale(1)}}`
    const h = (tag, props = {}, ...children) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'dataset') Object.assign(node.dataset, value); else node.setAttribute(key, value) }); for (const child of children) node.append(child); return node }
    const text = value => document.createTextNode(String(value))
    let selectedAgentId
    let sessionService
    function layout(snapshot, origin) {
      if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error("node: graph origin is invalid")
      const roots = new Set(snapshot.roots); const agents = [...snapshot.agents].sort((a, b) => Number(roots.has(b.id)) - Number(roots.has(a.id))); const result = new Map()
      agents.forEach((agent, index) => {
        const ring = Math.floor(index / 6); const radius = 172 + ring * 112
        const angle = -Math.PI / 2 + (index % 6) * Math.PI / 3 + (ring % 2 ? Math.PI / 6 : 0)
        result.set(agent.id, { x: origin.x + Math.cos(angle) * radius - 67, y: origin.y + Math.sin(angle) * radius - 23, width: 134, height: 46 })
      })
      return result
    }
    function inspector(root, agent) {
      root.querySelector(".canvas-inspector")?.remove(); if (!agent) return
      root.append(h("aside", { className: "canvas-inspector" }, h("div", { className: "canvas-inspector-title" }, text(agent.name)), h("div", { className: "canvas-inspector-subtitle" }, text("spawned from singularity · " + agent.status))))
    }
    function blocksText(content) {
      if (!Array.isArray(content)) return ''
      return content.map(block => block && block.type === 'text' ? block.text : '').filter(Boolean).join('\n')
    }
    function sessionTranscript(agent, sessions) {
      const body = document.createElement('div')
      body.className = 'canvas-session-transcript'
      body.dataset.sessionId = String(agent.id)
      const binding = sessions.binding(agent.id)
      if (!binding) throw new Error('node: session binding is missing for ' + agent.id)
      const paint = () => {
        body.replaceChildren()
        const rows = []
        for (const entry of binding.eventSource.getSnapshot().entries) {
          if (entry.type !== 'event') continue
          const event = entry.event
          if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
            const value = blocksText(event.data.content)
            if (value) rows.push({ role: 'user', text: value })
          } else if (event.type === 'assistant/message') {
            const value = blocksText(event.data.message?.content)
            if (value) rows.push({ role: 'assistant', text: value })
          }
        }
        for (const pending of binding.session.getSnapshot().pendingSubmissions) {
          if (pending.placement !== 'transcript' || !pending.text) continue
          rows.push({ role: 'user', text: pending.text })
        }
        if (rows.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'canvas-session-empty'
          empty.textContent = 'No messages yet'
          body.append(empty)
          return
        }
        for (const row of rows) {
          const item = document.createElement('div')
          item.className = 'canvas-session-message'
          item.dataset.role = row.role
          const role = document.createElement('div')
          role.className = 'canvas-session-role'
          role.textContent = row.role
          const content = document.createElement('div')
          content.className = 'canvas-session-text'
          content.textContent = row.text
          item.append(role, content)
          body.append(item)
        }
      }
      paint()
      const stopEvents = binding.eventSource.subscribe(paint)
      const stopSession = binding.session.subscribe(paint)
      return { body, dispose: () => { stopEvents(); stopSession() } }
    }
    function select(agent, root, sessions) {
      selectedAgentId = agent.id
      sessions.open(agent.id)
      document.dispatchEvent(new CustomEvent("singularity:agent", { detail: agent }))
      if (!document.querySelector('[data-sticky-id="session:' + agent.id + '"]')) {
        const panel = sessionTranscript(agent, sessions)
        document.dispatchEvent(new CustomEvent('sticky:open', { detail: { id: `session:${agent.id}`, title: 'Session', body: panel.body, dispose: panel.dispose, target: agent, session: true } }))
      }
      document.dispatchEvent(new CustomEvent("singularity:node-selected", { detail: { agent, agentId: agent.id } }))
      inspector(root, agent)
      document.querySelectorAll('.canvas-node').forEach(item => { item.dataset.selected = String(item.dataset.agentId === selectedAgentId) })
    }
    function draw(event) {
      const layer = document.querySelector(".canvas-nodes"); const groups = document.querySelector(".canvas-groups"); const root = document.querySelector(".canvas-root"); if (!layer || !groups || !root) throw new Error("node: canvas layers are not mounted")
      const snapshot = event.detail.snapshot; const positions = layout(snapshot, event.detail.origin); layer.replaceChildren(); groups.replaceChildren(); const byId = new Map(snapshot.agents.map(agent => [agent.id, agent]))
      if (selectedAgentId !== undefined && !byId.has(selectedAgentId)) selectedAgentId = undefined
      snapshot.groups.forEach(group => { const members = group.memberIds.map(id => byId.get(id)); if (members.some(agent => !agent)) throw new Error("node: group " + group.id + " references an unknown agent"); const nodes = members.map(agent => positions.get(agent.id)); if (nodes.some(item => !item)) throw new Error("node: group " + group.id + " has no visual position"); const x = Math.min(...nodes.map(item => item.x)) - 22; const y = Math.min(...nodes.map(item => item.y)) - 30; const width = Math.max(...nodes.map(item => item.x + item.width)) - x + 22; const height = Math.max(...nodes.map(item => item.y + item.height)) - y + 30; const box = h("div", { className: "canvas-group", style: "left:" + x + "px;top:" + y + "px;width:" + width + "px;height:" + height + "px" }, h("div", { className: "canvas-group-label" }, text("Group " + group.id))); box.onclick = () => document.dispatchEvent(new CustomEvent("singularity:group", { detail: group })); groups.append(box) })
      snapshot.agents.forEach(agent => { const position = positions.get(agent.id); if (!position) throw new Error("node: agent " + agent.id + " has no visual position"); const item = h("article", { className: "canvas-node", dataset: { agentId: agent.id, shape: "card", status: agent.status, unread: "false", selected: String(agent.id === selectedAgentId) }, style: "left:" + position.x + "px;top:" + position.y + "px;width:" + position.width + "px;height:" + position.height + "px" }, h("span", { className: "canvas-node-unread" }), h("div", { className: "canvas-node-name" }, text(agent.name)), h("div", { className: "canvas-node-meta" }, h("span", {}, h("span", { className: "canvas-dot", dataset: { status: agent.status } }), text(agent.status)), h("span", {}, text(agent.routerFor ? "router" : "agent")))); const report = h("button", { className: "canvas-node-report", title: "Open report", "aria-label": "Open report" }, text("i")); report.onclick = event => { event.stopPropagation(); document.dispatchEvent(new CustomEvent("singularity:report", { detail: agent })) }; item.onclick = () => { document.dispatchEvent(new CustomEvent("singularity:unread", { detail: { agentId: agent.id, unread: false } })); select(agent, root, sessionService) }; layer.append(item) })
      inspector(root, selectedAgentId === undefined ? undefined : byId.get(selectedAgentId))
    }
    function focus(event) {
      const id = event.detail?.agentId; const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === id); if (!item) throw new Error("node: focus target is not rendered: " + String(id)); item.click(); item.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
    function unread(event) { const item = [...document.querySelectorAll('.canvas-node')].find(node => node.dataset.agentId === event.detail.agentId); if (item) item.dataset.unread = String(event.detail.unread) }
    function apply(ctx) { sessionService = ctx.sessions; ctx.effect(() => { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); document.addEventListener('canvas:graph', draw); document.addEventListener('singularity:unread', unread); document.addEventListener('singularity:focus-node', focus); return () => { document.removeEventListener('canvas:graph', draw); document.removeEventListener('singularity:unread', unread); document.removeEventListener('singularity:focus-node', focus); sessionService = undefined; style.remove() } }, 'node: lifecycle') }
    module.exports.apply = apply
    module.exports.inject = ['sessions']
    return module.exports
  },
})
