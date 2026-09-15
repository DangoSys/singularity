import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore, type ChatRow, type HitlPending } from '../store'

const PANEL_MIN = 320
const PANEL_DEFAULT = 400
const PANEL_KEY = 'sg-focus-width'

function loadWidth(): number {
  const raw = localStorage.getItem(PANEL_KEY)
  if (raw === null) return PANEL_DEFAULT
  const n = Number(raw)
  if (!Number.isFinite(n) || n < PANEL_MIN) throw new Error(`map: invalid panel width ${raw}`)
  return n
}

function HitlCard({ item }: { item: HitlPending }) {
  const answerHitl = useStore(s => s.answerHitl)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (
    answer: { kind: 'ask'; text: string } | { kind: 'approve'; decision: 'approve' | 'reject' },
  ) => {
    setSubmitting(true)
    setError(null)
    try {
      await answerHitl(item.id, answer)
      setText('')
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (item.kind === 'ask') {
    return (
      <form
        className="sg-hitl"
        onSubmit={e => {
          e.preventDefault()
          const value = text.trim()
          if (value.length === 0) throw new Error('map: empty hitl answer')
          void submit({ kind: 'ask', text: value })
        }}
      >
        <div className="sg-hitl-label">Ask</div>
        <div className="sg-hitl-prompt">{item.prompt}</div>
        <textarea
          value={text}
          disabled={submitting}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="Your answer…"
        />
        <button type="submit" disabled={submitting || text.trim().length === 0}>
          Submit
        </button>
        {error !== null && <div role="alert">{error}</div>}
      </form>
    )
  }

  return (
    <div className="sg-hitl">
      <div className="sg-hitl-label">Approve</div>
      <div className="sg-hitl-prompt">{item.prompt}</div>
      <div className="sg-hitl-actions">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit({ kind: 'approve', decision: 'approve' })}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={submitting}
          className="reject"
          onClick={() => void submit({ kind: 'approve', decision: 'reject' })}
        >
          Reject
        </button>
      </div>
      {error !== null && <div role="alert">{error}</div>}
    </div>
  )
}

function MessageList({ rows }: { rows: ChatRow[] }) {
  const list = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  useEffect(() => {
    if (follow.current && list.current !== null) list.current.scrollTop = list.current.scrollHeight
  }, [rows])
  if (rows.length === 0) {
    return <div className="sg-focus-empty">No messages yet</div>
  }
  return (
    <div
      ref={list}
      className="sg-focus-msgs"
      onScroll={event => {
        const element = event.currentTarget
        follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32
      }}
    >
      {rows.map((row, i) => (
        <div key={`${row.role}-${i}`} className="sg-focus-msg" data-role={row.role}>
          <div className="sg-focus-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.text}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FocusPanel() {
  const selectedId = useStore(s => s.selectedId)
  const graphMeta = useStore(s => s.graphMeta)
  const chat = useStore(s => s.chat)
  const hitl = useStore(s => s.hitl)
  const sendPrompt = useStore(s => s.sendPrompt)
  const setSelected = useStore(s => s.setSelected)
  const [width, setWidth] = useState(loadWidth)
  const [resizing, setResizing] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const agent = useStore(s => s.graph?.agents.find(a => a.id === selectedId))

  if (selectedId === null) return null

  if (agent === undefined) throw new Error(`map: focus panel missing agent ${selectedId}`)

  const sessionHitl = hitl.filter(h => h.sessionId === selectedId)
  const ready = graphMeta?.ready === true
  const freeLocked = !ready
  const rows = chat.sessionId === selectedId ? chat.rows : []

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setResizing(true)
  }
  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizing) return
    const maxW = Math.floor(window.innerWidth * 0.7)
    setWidth(Math.min(maxW, Math.max(PANEL_MIN, window.innerWidth - 12 - e.clientX)))
  }
  const onResizePointerUp = (e: React.PointerEvent) => {
    if (!resizing) return
    setResizing(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    localStorage.setItem(PANEL_KEY, String(width))
  }
  const onResizeDoubleClick = () => {
    setWidth(PANEL_DEFAULT)
    localStorage.removeItem(PANEL_KEY)
  }

  return (
    <aside className={`sg-focus${resizing ? ' resizing' : ''}`} style={{ width }} data-focus-panel>
      <div
        className="sg-focus-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onDoubleClick={onResizeDoubleClick}
      />
      <header className="sg-focus-head">
        <div className="sg-focus-title">
          <strong>{agent.name}</strong>
          <span>{agent.status}</span>
          <span className={ready ? 'ready' : 'setup'}>{ready ? 'ready' : 'setup'}</span>
        </div>
        <button type="button" className="sg-focus-close" onClick={() => setSelected(null)} aria-label="Close">
          ×
        </button>
      </header>
      <div className="sg-focus-body">
        <section className="sg-focus-section">
          <div className="sg-focus-section-title">Session</div>
          <div className="sg-focus-session">{selectedId}</div>
        </section>
        {sessionHitl.map(item => (
          <HitlCard key={item.id} item={item} />
        ))}
        <section className="sg-focus-section grow">
          <div className="sg-focus-section-title">Conversation</div>
          <MessageList rows={rows} />
        </section>
      </div>
      {freeLocked ? (
        <div className="sg-focus-lock">
          <strong>Free chat to this node is locked.</strong>
          <span>
            Because <em>(Graph is not ready.)</em>
          </span>
        </div>
      ) : (
        <form
          className="sg-focus-input"
          onSubmit={async e => {
            e.preventDefault()
            const text = draft.trim()
            if (text.length === 0) throw new Error('map: empty follow-up')
            setSending(true)
            setError(null)
            try {
              await sendPrompt(selectedId, text)
              setDraft('')
            } catch (error) {
              setError(error instanceof Error ? error.message : String(error))
            } finally {
              setSending(false)
            }
          }}
        >
          <textarea
            value={draft}
            disabled={sending}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Follow up…"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <button type="submit" disabled={sending || draft.trim().length === 0}>
            {sending ? 'Sending…' : 'Send'}
          </button>
          {error !== null && <div role="alert">{error}</div>}
        </form>
      )}
    </aside>
  )
}
