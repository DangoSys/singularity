import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('binds HTTP and SSE to the URL graph, preserves cleared selection, and awaits prompt acknowledgement', async () => {
  const view = {
    meta: { id: 'a', name: 'A', rootSessionId: 'root-a', graphStoreId: 'g-a', layoutStoreId: 'l-a', ready: true },
    graph: { version: 1, id: 'g-a', roots: ['root-a'], agents: [{ id: 'root-a', name: 'A', status: 'idle' }], edges: [], groups: [] },
    layout: { version: 1, id: 'l-a', nodes: { 'root-a': { x: 80, y: 80, width: 168, height: 76, shape: 'card' } } },
  }
  const postMessage = vi.fn()
  vi.stubGlobal('window', { location: { search: '?graphId=a' }, parent: { postMessage } })
  vi.stubGlobal('location', { origin: 'http://test.local' })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    expect(url).toMatch(/^\/singularity\/(graph\?graphId=a|hitl)$/)
    return new Response(JSON.stringify(url.includes('/hitl') ? { pending: [] } : view))
  }))
  const sources: string[] = []
  vi.stubGlobal('EventSource', class extends EventTarget {
    constructor(url: string) { super(); sources.push(url) }
    close() {}
  })
  const { useStore } = await import('../../map/src/store.ts')
  await useStore.getState().boot()
  expect(sources).toEqual(['/singularity/events?graphId=a'])
  const answering = useStore.getState().answerHitl('h1', { kind: 'ask', text: 'answer' })
  const nextQuestion = { id: 'h2', kind: 'ask' as const, prompt: 'next?', sessionId: 'root-a', createdAt: 1 }
  useStore.getState().applyHitl([nextQuestion])
  await answering
  expect(useStore.getState().hitl).toEqual([nextQuestion])
  expect(useStore.getState().selectedId).toBe('root-a')
  useStore.getState().setSelected(null)
  useStore.getState().applySnapshot(view as never)
  expect(useStore.getState().selectedId).toBeNull()
  expect(useStore.getState().nodes).toHaveLength(1)
  expect(() => useStore.getState().applySnapshot({ ...view, meta: { ...view.meta, id: 'b' } } as never)).toThrow('wrong graph')
  const prompt = useStore.getState().sendPrompt('root-a', 'hello')
  const rejected = expect(prompt).rejects.toThrow('submission rejected')
  const request = postMessage.mock.calls.at(-1)![0]
  expect(request).toMatchObject({ type: 'singularity:prompt', graphId: 'a', text: 'hello' })
  expect(useStore.getState().submission).not.toBeNull()
  useStore.getState().finishPrompt(request.requestId, 'submission rejected')
  await rejected
  expect(useStore.getState().submission).toBeNull()
})
