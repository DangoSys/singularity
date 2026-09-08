import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { GraphState } from '../../graph/src/service/state.ts'

const id = (value: string) => value as SessionId
const node = { x: 10, y: 20, width: 168, height: 76, shape: 'card' as const }

describe('graph topology roundtrip', () => {
  it('builds root, spawn edge, group, and status updates', () => {
    const state = new GraphState('graph-state')
    state.apply({
      kind: 'agent/add',
      root: true,
      agent: { id: id('root'), name: 'Singularity', status: 'idle', node },
    })
    state.apply({
      kind: 'agent/add',
      agent: { id: id('child'), name: 'DangoSys/buckyball', status: 'idle', node },
    })
    state.apply({
      kind: 'edge/add',
      edge: { id: 'root->child', kind: 'spawn', from: id('root'), to: id('child') },
    })
    state.apply({
      kind: 'group/add',
      group: { id: 'g1', routerId: id('root'), transcriptId: id('t1'), memberIds: [id('root')] },
    })
    state.apply({ kind: 'member/add', groupId: 'g1', agentId: id('child') })
    state.apply({ kind: 'agent/status', agentId: id('child'), status: 'running' })
    state.apply({ kind: 'agent/status', agentId: id('child'), status: 'idle' })

    const snap = state.snapshot()
    expect(snap.roots).toEqual(['root'])
    expect(snap.agents.map(a => a.id)).toEqual(['root', 'child'])
    expect(snap.edges).toEqual([{ id: 'root->child', kind: 'spawn', from: 'root', to: 'child' }])
    expect(snap.groups).toEqual([
      { id: 'g1', routerId: 'root', transcriptId: 't1', memberIds: ['root', 'child'] },
    ])
    expect(snap.agents.find(a => a.id === 'child')?.status).toBe('idle')
  })

  it('clone is isolated from further applies', () => {
    const state = new GraphState('graph-state')
    state.apply({
      kind: 'agent/add',
      root: true,
      agent: { id: id('root'), name: 'Singularity', status: 'idle', node },
    })
    const frozen = state.clone().snapshot()
    state.apply({ kind: 'agent/status', agentId: id('root'), status: 'running' })
    expect(frozen.agents[0]?.status).toBe('idle')
    expect(state.snapshot().agents[0]?.status).toBe('running')
  })
})
