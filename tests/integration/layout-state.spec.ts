import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { LayoutState } from '../../layout/src/service/state.ts'
import { DEFAULT_ROOT } from '../../layout/src/types.ts'

const id = (value: string) => value as SessionId

describe('layout roundtrip', () => {
  it('sets, gets, and removes nodes', () => {
    const state = new LayoutState('layout-state')
    state.apply({ kind: 'node/set', sessionId: id('root'), node: DEFAULT_ROOT })
    expect(state.get(id('root'))).toEqual(DEFAULT_ROOT)

    const child = { ...DEFAULT_ROOT, x: 420, y: 120, shape: 'circle' as const }
    state.apply({ kind: 'node/set', sessionId: id('child'), node: child })
    expect(state.snapshot().nodes).toEqual({ root: DEFAULT_ROOT, child })

    state.apply({ kind: 'node/remove', sessionId: id('child') })
    expect(state.snapshot().nodes).toEqual({ root: DEFAULT_ROOT })
    expect(() => state.get(id('child'))).toThrow(/unknown session/)
  })
})
