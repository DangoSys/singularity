import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

type Rows = { role: 'user' | 'assistant'; text: string }[]
type TranscriptRows = (entries: unknown[], session: { queue: unknown[]; pendingSubmissions: unknown[] }) => Rows

let transcriptRows!: TranscriptRows
runInNewContext(readFileSync(new URL('../../src/frontend/client.js', import.meta.url), 'utf8'), {
  window: {
    __ModuleLoader__: {
      load: ({ factory }: { factory: () => { transcriptRows: TranscriptRows } }) => {
        transcriptRows = factory().transcriptRows
      },
    },
  },
})

function pending(requestId: string, placement: 'transcript' | 'queued' | 'steering' = 'queued') {
  return { requestId, placement, time: 0, text: 'follow up', attachments: [] }
}

function queue(rpcId: string | undefined = 'request-1') {
  return {
    id: 'occurrence-1',
    messageId: 'message-1',
    rpcId,
    placement: 'queued',
    content: [{ type: 'text', text: 'follow up' }],
    preview: 'follow up',
    text: 'follow up',
  }
}

function durable(rpcId?: string) {
  return {
    type: 'event',
    event: {
      type: 'user/message',
      seq: 1,
      time: 0,
      data: {
        id: 'message-1',
        role: 'user',
        source: { kind: 'user', rpcId },
        content: [{ type: 'text', text: 'follow up' }],
      },
    },
  }
}

function live(attemptId: string, text: string) {
  return {
    type: 'transient',
    event: {
      type: 'assistant/live-chunk',
      seq: 1,
      time: 0,
      data: { attemptId, turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text } },
    },
  }
}

describe('canvas transcript projection', () => {
  it('keeps a running-session submission visible throughout echo, queue admission and durable handoff', () => {
    const expected = [{ role: 'user', text: 'follow up' }]
    expect(transcriptRows([], { queue: [], pendingSubmissions: [pending('request-1')] })).toEqual(expected)
    expect(transcriptRows([], { queue: [queue()], pendingSubmissions: [pending('request-1')] })).toEqual(expected)
    expect(transcriptRows([], { queue: [queue()], pendingSubmissions: [] })).toEqual(expected)
    expect(
      transcriptRows([durable('request-1')], { queue: [queue()], pendingSubmissions: [pending('request-1')] }),
    ).toEqual(expected)
    expect(transcriptRows([durable('request-1')], { queue: [], pendingSubmissions: [] })).toEqual(expected)
  })

  it('deduplicates the one-frame durable/echo overlap by request identity, not message text', () => {
    expect(
      transcriptRows([durable('request-1')], {
        queue: [],
        pendingSubmissions: [pending('request-1', 'transcript'), pending('request-2', 'transcript')],
      }),
    ).toEqual([
      { role: 'user', text: 'follow up' },
      { role: 'user', text: 'follow up' },
    ])
  })

  it('uses message identity for non-RPC queue handoff and leaves injected context out of user rows', () => {
    const item = { ...queue(), rpcId: undefined }
    const event = durable()
    expect(transcriptRows([event], { queue: [item], pendingSubmissions: [] })).toEqual([
      { role: 'user', text: 'follow up' },
    ])
    expect(transcriptRows([], { queue: [{ ...item, placement: 'context' }], pendingSubmissions: [] })).toEqual([])
  })

  it('shows the assistant while it is streaming', () => {
    expect(
      transcriptRows([live('attempt-1', 'Hello '), live('attempt-1', '**world**')], {
        queue: [],
        pendingSubmissions: [],
      }),
    ).toEqual([{ role: 'assistant', text: 'Hello **world**' }])
  })
})
