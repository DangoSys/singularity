window.__ModuleLoader__.load({
  id: '@dangosys/dsh-singularity-canvas-view',
  factory: () => {
    const module = { exports: {} }
    const MAP = '/singularity/map/'
    const GRAPHS = '/singularity/graphs'
    const ENVS = '/singularity/graph-envs'
    const REPO_CHECK = '/singularity/repo-check'
    const STYLE = `
.sg-switch{position:fixed;z-index:130;top:12px;left:50%;display:flex;gap:2px;transform:translateX(-50%);border:1px solid #d1d5db;border-radius:999px;background:rgba(255,255,255,.96);padding:3px;backdrop-filter:blur(10px)}
.sg-switch button{height:28px;border:0;border-radius:999px;background:transparent;padding:0 11px;color:#6b7280;font:600 12px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.sg-switch button:hover{background:#f3f4f6;color:#111827}
.sg-switch button.active{background:#111827;color:#fff}
.sg-shell{position:fixed;z-index:100;inset:0;display:none;background:#faf9f7;color:#1a1a1a;font:12px Inter,system-ui,sans-serif}
.sg-shell.open{display:flex}
.sg-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
.sg-frame{flex:1;min-height:0;border:0;width:100%;background:#faf9f7}
.sg-side{position:absolute;z-index:5;left:14px;top:14px;width:340px;display:flex;flex-direction:column;gap:10px;max-height:calc(100% - 28px);pointer-events:none}
.sg-side>*{pointer-events:auto}
.sg-graphs{flex:none;border:1px solid #e8e5e0;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(26,26,26,.1);backdrop-filter:blur(12px);overflow:hidden}
.sg-graphs-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e8e5e0;font-weight:700}
.sg-graphs-head button{height:24px;border:0;border-radius:6px;padding:0 8px;background:#111827;color:#fff;font:600 11px Inter,system-ui,sans-serif;cursor:pointer}
.sg-graphs-list{max-height:220px;overflow:auto}
.sg-graph-row{display:flex;align-items:stretch;border-bottom:1px solid #f0eeea}
.sg-graph-row button.select{flex:1;border:0;background:transparent;text-align:left;padding:8px 10px;cursor:pointer;color:#1a1a1a}
.sg-graph-row button.select:hover{background:#f5f3f0}
.sg-graph-row.active button.select{background:#efeaff;color:#5a4bd6;font-weight:700}
.sg-graph-row button.del{flex:none;width:34px;border:0;border-left:1px solid #f0eeea;background:transparent;color:#968c77;cursor:pointer}
.sg-graph-row button.del:hover{background:#fef2f2;color:#dc2626}
.sg-graphs-empty{padding:12px 10px;color:#968c77}
.sg-create{flex:none;display:none;border:1px solid #e8e5e0;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(26,26,26,.1);padding:12px;overflow:auto;max-height:min(520px,calc(100vh - 200px))}
.sg-create.open{display:block}
.sg-create h3{margin:0 0 8px;font-size:13px}
.sg-create label{display:block;margin:8px 0 4px;color:#6b6560;font-weight:600}
.sg-create select,.sg-create input[data-field]{width:100%;box-sizing:border-box;height:30px;border:1px solid #e8e5e0;border-radius:8px;padding:0 8px;font:12px Inter,system-ui,sans-serif}
.sg-env-row{display:flex;gap:6px;align-items:center}
.sg-env-row select{flex:1;min-width:0}
.sg-env-new{flex:none;width:30px;height:30px;border:1px solid #e8e5e0;border-radius:8px;background:#f5f3f0;color:#1a1a1a;font:700 16px Inter,system-ui,sans-serif;line-height:1;cursor:pointer}
.sg-env-new.active{background:#111827;color:#fff;border-color:#111827}
.sg-env-new-panel{display:none;margin-top:8px}
.sg-env-new-panel.open{display:block}
.sg-env-hint{color:#968c77;font-size:11px;margin:0 0 6px}
.sg-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:34px;border:1px solid #e8e5e0;border-radius:8px;padding:4px 6px;background:#faf9f7;flex:1;min-width:0}
.sg-tag{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 6px 0 8px;border-radius:999px;background:#efeaff;color:#5a4bd6;font:600 11px Inter,system-ui,sans-serif}
.sg-tag button{border:0;background:transparent;color:#5a4bd6;cursor:pointer;font-size:14px;line-height:1;padding:0}
.sg-tags input{flex:1;min-width:100px;height:24px;border:0;background:transparent;outline:none;font:12px Inter,system-ui,sans-serif}
.sg-repo-row{display:flex;gap:6px;align-items:flex-start}
.sg-repo-add{flex:none;width:30px;height:34px;border:1px solid #e8e5e0;border-radius:8px;background:#f5f3f0;color:#1a1a1a;font:700 16px Inter,system-ui,sans-serif;cursor:pointer}
.sg-repo-add:disabled{opacity:.45;cursor:not-allowed}
.sg-tags-err,.sg-create-err{color:#dc2626;font-size:11px;margin-top:6px;white-space:pre-wrap}
.sg-create-status{color:#6b6560;font-size:11px;margin-top:6px;min-height:14px}
.sg-create-actions{display:flex;gap:6px;margin-top:12px;justify-content:flex-end}
.sg-create-actions button{height:28px;border:0;border-radius:8px;padding:0 10px;font:600 12px Inter,system-ui,sans-serif;cursor:pointer}
.sg-create-actions .cancel{background:#f5f3f0;color:#6b6560}
.sg-create-actions .ok{background:#111827;color:#fff}
.sg-create-actions .ok:disabled{opacity:.45;cursor:not-allowed}
`
    module.exports.inject = ['sessions']
    module.exports.apply = (ctx) => {
      const style = document.createElement('style')
      style.textContent = STYLE
      document.head.append(style)

      const host = document.createElement('div')
      host.innerHTML = [
        '<div class="sg-switch" role="group" aria-label="view switch">',
        '<button type="button" data-view="dialog" class="active" aria-pressed="true">对话</button>',
        '<button type="button" data-view="map" aria-pressed="false">Singularity</button>',
        '</div>',
        '<section class="sg-shell">',
        '<div class="sg-main">',
        '<iframe class="sg-frame" title="Singularity map"></iframe>',
        '<div class="sg-side">',
        '<aside class="sg-graphs">',
        '<div class="sg-graphs-head"><span>Graphs</span><button type="button" data-action="new">New</button></div>',
        '<div class="sg-graphs-list"></div>',
        '</aside>',
        '<div class="sg-create">',
        '<h3>New graph</h3>',
        '<label>Name</label><input data-field="name" placeholder="graph name"/>',
        '<label>Environment</label>',
        '<div class="sg-env-row"><select data-field="env"></select><button type="button" class="sg-env-new" data-action="env-new" title="Create new environment">+</button></div>',
        '<div class="sg-env-new-panel" data-panel="env-new">',
        '<p class="sg-env-hint">Add github environments below (as owner/repo)</p>',
        '<div class="sg-repo-row"><div class="sg-tags" data-field="tags"><input data-field="repo" placeholder="owner/repo" autocomplete="off"/></div><button type="button" class="sg-repo-add" data-action="repo-add" title="Add repository">+</button></div>',
        '<div class="sg-tags-err" data-field="repo-err"></div>',
        '</div>',
        '<div class="sg-create-status" data-field="create-status"></div>',
        '<div class="sg-create-err" data-field="create-err"></div>',
        '<div class="sg-create-actions"><button type="button" class="cancel" data-action="cancel">Cancel</button><button type="button" class="ok" data-action="create">Create</button></div>',
        '</div>',
        '</div>',
        '</div>',
        '</section>',
      ].join('')
      document.body.append(host)

      const dialogBtn = host.querySelector('[data-view="dialog"]')
      const mapBtn = host.querySelector('[data-view="map"]')
      const shell = host.querySelector('.sg-shell')
      const frame = host.querySelector('.sg-frame')
      const listEl = host.querySelector('.sg-graphs-list')
      const createEl = host.querySelector('.sg-create')
      const envSelect = host.querySelector('[data-field="env"]')
      const nameInput = host.querySelector('[data-field="name"]')
      const envNewBtn = host.querySelector('[data-action="env-new"]')
      const envNewPanel = host.querySelector('[data-panel="env-new"]')
      const tagsEl = host.querySelector('[data-field="tags"]')
      const repoInput = host.querySelector('[data-field="repo"]')
      const repoErr = host.querySelector('[data-field="repo-err"]')
      const createErr = host.querySelector('[data-field="create-err"]')
      const createStatus = host.querySelector('[data-field="create-status"]')
      const repoAddBtn = host.querySelector('[data-action="repo-add"]')
      const createBtn = host.querySelector('[data-action="create"]')
      const cancelBtn = host.querySelector('[data-action="cancel"]')
      const newBtn = host.querySelector('[data-action="new"]')
      if (!dialogBtn || !mapBtn || !shell || !frame || !listEl || !createEl || !envSelect || !nameInput || !envNewBtn || !envNewPanel || !tagsEl || !repoInput || !repoErr || !createErr || !createStatus || !repoAddBtn || !createBtn || !cancelBtn || !newBtn) {
        throw new Error('singularity shell: mount failed')
      }

      let graphsSnap = null
      let chat = { sessionId: null, dispose: null }
      let createMode = 'existing'
      let plannedRepos = []
      let checkingRepo = false
      let creating = false

      const setView = (view) => {
        const map = view === 'map'
        dialogBtn.classList.toggle('active', !map)
        mapBtn.classList.toggle('active', map)
        dialogBtn.setAttribute('aria-pressed', String(!map))
        mapBtn.setAttribute('aria-pressed', String(map))
        shell.classList.toggle('open', map)
        if (map && !frame.getAttribute('src')) frame.setAttribute('src', MAP)
        if (map) void refreshGraphs()
      }

      const blocksText = (content) => {
        if (!Array.isArray(content)) return ''
        return content.map((block) => (block && block.type === 'text' ? block.text : '')).filter(Boolean).join('\n')
      }

      const postTranscript = (sessionId, rows) => {
        frame.contentWindow?.postMessage({ type: 'singularity:transcript', sessionId, rows }, '*')
      }

      const bindChat = (sessionId) => {
        if (chat.dispose) chat.dispose()
        chat = { sessionId, dispose: null }
        ctx.sessions.open(sessionId)
        const binding = ctx.sessions.binding(sessionId)
        if (binding === undefined) throw new Error('singularity: session binding missing for ' + sessionId)
        const paint = () => {
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
          postTranscript(sessionId, rows)
        }
        paint()
        const stopEvents = binding.eventSource.subscribe(paint)
        const stopSession = binding.session.subscribe(paint)
        chat.dispose = () => { stopEvents(); stopSession() }
        frame.contentWindow?.postMessage({ type: 'singularity:select', sessionId }, '*')
      }

      const clearChat = () => {
        if (chat.dispose) chat.dispose()
        chat = { sessionId: null, dispose: null }
      }

      const paintGraphs = () => {
        listEl.replaceChildren()
        const graphs = graphsSnap?.graphs ?? []
        if (graphs.length === 0) {
          const empty = document.createElement('div')
          empty.className = 'sg-graphs-empty'
          empty.textContent = 'No graphs — create one'
          listEl.append(empty)
          clearChat()
          return
        }
        for (const graph of graphs) {
          const row = document.createElement('div')
          row.className = 'sg-graph-row'
          if (graph.id === graphsSnap.selectedId) row.classList.add('active')
          const select = document.createElement('button')
          select.type = 'button'
          select.className = 'select'
          select.textContent = graph.name + (graph.ready ? '' : ' · setup')
          select.addEventListener('click', () => {
            void selectGraph(graph.id).catch((e) => { createErr.textContent = String(e?.message ?? e) })
          })
          const del = document.createElement('button')
          del.type = 'button'
          del.className = 'del'
          del.title = 'Delete graph'
          del.textContent = '⌫'
          del.addEventListener('click', () => {
            void deleteGraph(graph.id).catch((e) => { createErr.textContent = String(e?.message ?? e) })
          })
          row.append(select, del)
          listEl.append(row)
        }
        const selected = graphs.find(g => g.id === graphsSnap.selectedId)
        if (selected) bindChat(selected.rootSessionId)
        else clearChat()
      }

      const refreshGraphs = async () => {
        const res = await fetch(GRAPHS)
        const text = await res.text()
        if (!res.ok) throw new Error(text)
        graphsSnap = JSON.parse(text)
        paintGraphs()
        frame.contentWindow?.postMessage({ type: 'singularity:reload' }, '*')
      }

      const selectGraph = async (id) => {
        const res = await fetch(GRAPHS + '/' + encodeURIComponent(id) + '/select', { method: 'POST' })
        const text = await res.text()
        if (!res.ok) throw new Error(text)
        await refreshGraphs()
      }

      const deleteGraph = async (id) => {
        const res = await fetch(GRAPHS + '/' + encodeURIComponent(id) + '/delete', { method: 'POST' })
        const text = await res.text()
        if (!res.ok) throw new Error(text)
        await refreshGraphs()
      }

      const paintTags = () => {
        for (const node of [...tagsEl.querySelectorAll('.sg-tag')]) node.remove()
        for (const ref of plannedRepos) {
          const tag = document.createElement('span')
          tag.className = 'sg-tag'
          tag.append(document.createTextNode(ref))
          const rm = document.createElement('button')
          rm.type = 'button'
          rm.textContent = '×'
          rm.addEventListener('click', () => {
            plannedRepos = plannedRepos.filter((r) => r !== ref)
            paintTags()
          })
          tag.append(rm)
          tagsEl.insertBefore(tag, repoInput)
        }
      }

      const syncCreateEnabled = () => {
        repoAddBtn.disabled = checkingRepo || creating || createMode !== 'new'
        envNewBtn.disabled = creating
        createBtn.disabled = creating || checkingRepo || (createMode === 'existing' && envSelect.value.length === 0)
      }

      const setCreateMode = (mode) => {
        createMode = mode
        envNewBtn.classList.toggle('active', mode === 'new')
        envNewPanel.classList.toggle('open', mode === 'new')
        envSelect.disabled = mode === 'new' || creating
        if (mode === 'existing') {
          plannedRepos = []
          paintTags()
          repoInput.value = ''
          repoErr.textContent = ''
        }
        syncCreateEnabled()
      }

      const closeCreate = () => {
        createEl.classList.remove('open')
        createErr.textContent = ''
        createStatus.textContent = ''
        creating = false
        createBtn.textContent = 'Create'
        syncCreateEnabled()
      }

      const openCreate = async () => {
        if (createEl.classList.contains('open')) {
          closeCreate()
          return
        }
        createErr.textContent = ''
        createStatus.textContent = ''
        const res = await fetch(ENVS)
        const text = await res.text()
        if (!res.ok) throw new Error(text)
        const data = JSON.parse(text)
        envSelect.replaceChildren()
        const available = data.envs.filter((env) => env.available)
        if (available.length === 0) {
          const opt = document.createElement('option')
          opt.value = ''
          opt.textContent = 'No available environments'
          envSelect.append(opt)
        } else {
          for (const env of available) {
            const opt = document.createElement('option')
            opt.value = env.id
            opt.textContent = env.id + (env.componentCount ? ` (${env.componentCount} components)` : ' (empty)')
            envSelect.append(opt)
          }
        }
        nameInput.value = ''
        plannedRepos = []
        paintTags()
        repoErr.textContent = ''
        setCreateMode(available.length === 0 ? 'new' : 'existing')
        createEl.classList.add('open')
        nameInput.focus()
      }

      const addRepoTag = async () => {
        const raw = repoInput.value.trim().replace(/,/g, '')
        if (raw.length === 0) {
          repoErr.textContent = 'type owner/repo first'
          return
        }
        if (checkingRepo || creating) return
        checkingRepo = true
        syncCreateEnabled()
        repoErr.textContent = ''
        try {
          const res = await fetch(REPO_CHECK, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ repo: raw }),
          })
          const text = await res.text()
          if (!res.ok) {
            repoErr.textContent = text
            return
          }
          const data = JSON.parse(text)
          if (plannedRepos.includes(data.ref)) {
            repoErr.textContent = 'already added'
            return
          }
          plannedRepos.push(data.ref)
          repoInput.value = ''
          paintTags()
          repoInput.focus()
        } finally {
          checkingRepo = false
          syncCreateEnabled()
        }
      }

      const createGraph = async () => {
        if (creating) return
        createErr.textContent = ''
        const body = { name: nameInput.value.trim() || undefined }
        if (createMode === 'new') {
          body.createEnv = true
          body.repos = [...plannedRepos]
        } else {
          if (envSelect.value.length === 0) {
            createErr.textContent = 'Pick an environment or press + to create one'
            return
          }
          body.envId = envSelect.value
        }
        creating = true
        createBtn.textContent = 'Creating…'
        createStatus.textContent = 'Creating graph…'
        syncCreateEnabled()
        try {
          const res = await fetch(GRAPHS, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          const text = await res.text()
          if (!res.ok) {
            createErr.textContent = text || ('HTTP ' + res.status)
            createStatus.textContent = ''
            return
          }
          closeCreate()
          await refreshGraphs()
        } catch (error) {
          createErr.textContent = error instanceof Error ? error.message : String(error)
          createStatus.textContent = ''
        } finally {
          creating = false
          createBtn.textContent = 'Create'
          syncCreateEnabled()
        }
      }

      dialogBtn.addEventListener('click', () => setView('dialog'))
      mapBtn.addEventListener('click', () => setView('map'))
      newBtn.addEventListener('click', () => { void openCreate().catch((e) => { createErr.textContent = String(e) }) })
      cancelBtn.addEventListener('click', () => closeCreate())
      createBtn.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void createGraph()
      })
      envNewBtn.addEventListener('click', () => {
        if (creating) return
        setCreateMode(createMode === 'new' ? 'existing' : 'new')
      })
      repoAddBtn.addEventListener('click', () => { void addRepoTag() })
      envSelect.addEventListener('change', syncCreateEnabled)
      repoInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault()
          void addRepoTag()
        }
        if (event.key === 'Backspace' && repoInput.value.length === 0 && plannedRepos.length > 0) {
          plannedRepos = plannedRepos.slice(0, -1)
          paintTags()
        }
      })

      window.addEventListener('message', (event) => {
        if (event.source !== frame.contentWindow) return
        const data = event.data
        if (!data || typeof data !== 'object') return
        if (data.type === 'singularity:open') {
          if (typeof data.sessionId !== 'string' || data.sessionId.length === 0) {
            throw new Error('singularity: open message missing sessionId')
          }
          bindChat(data.sessionId)
          return
        }
        if (data.type === 'singularity:prompt') {
          if (typeof data.sessionId !== 'string' || typeof data.text !== 'string') {
            throw new Error('singularity: prompt message invalid')
          }
          const selected = graphsSnap?.graphs?.find((g) => g.id === graphsSnap.selectedId)
          if (selected === undefined) throw new Error('singularity: no selected graph for prompt')
          if (!selected.ready) throw new Error('singularity: free chat locked until graph is ready')
          const text = data.text.trim()
          if (text.length === 0) throw new Error('singularity: empty prompt')
          const binding = ctx.sessions.binding(data.sessionId)
          if (binding === undefined) throw new Error('singularity: session binding missing')
          const handle = binding.session.beginSubmission({ mode: 'queue', text, attachments: [] })
          void binding.session.prompt([{ type: 'text', text }], 'queue', undefined, handle.requestId).then((result) => {
            if (!result.ok) {
              handle.abandon()
              throw new Error('singularity chat: prompt failed: ' + JSON.stringify(result.error))
            }
          })
        }
      })
    }
    return module.exports
  },
})
