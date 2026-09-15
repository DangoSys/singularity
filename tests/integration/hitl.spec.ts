import { Context } from '../../../../thirdparty/deepseek-harness/vendor/cordis/lib/index.js'
import { expect, it } from 'vitest'
import { HitlService } from '../../agent-singularity/src/hitl.ts'

it('rejects invalid decisions without consuming the pending request', async () => {
  const hitl = new HitlService(new Context())
  const controller = new AbortController()
  const answer = hitl.approve('session', 'Continue?', controller.signal)
  const [{ id }] = hitl.list()
  expect(() => hitl.answer(id, { kind: 'approve', decision: 'maybe' } as never)).toThrow('invalid approval')
  expect(hitl.list()).toHaveLength(1)
  hitl.answer(id, { kind: 'approve', decision: 'reject' })
  controller.abort(new Error('cancel after answer'))
  await expect(answer).resolves.toBe('reject')
  expect(hitl.list()).toEqual([])
})

it('cancels pending questions when their tool execution is aborted', async () => {
  const hitl = new HitlService(new Context())
  const controller = new AbortController()
  const answer = hitl.ask('session', 'Which repo?', controller.signal)
  const rejected = expect(answer).rejects.toThrow('agent stopped')
  controller.abort(new Error('agent stopped'))
  await rejected
  expect(hitl.list()).toEqual([])
  expect(() => hitl.ask('session', 'Again?', controller.signal)).toThrow('agent stopped')
})
