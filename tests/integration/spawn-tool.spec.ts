import { describe, expect, it, vi } from 'vitest'
import { defineSpawnTool } from '../../agent-singularity/src/tools/spawn.ts'

describe('graph_spawn', () => {
  it('creates a Singularity worker and returns its final response', async () => {
    const worker = {
      id: 'worker-1',
      cancel: vi.fn(),
      whenIdle: vi.fn(async () => {}),
      session: {
        snapshotEvents: () => [
          {
            type: 'assistant/message',
            data: { message: { content: [{ type: 'text', text: 'tests passed' }] } },
          },
        ],
      },
    }
    const spawn = vi.fn(async () => ({ agent: worker }))
    const tool = defineSpawnTool({ agentRuntime: { spawn } } as never)
    const parent = { id: 'root-1' }
    const result = await tool.execute({ name: 'test-worker', task: 'Run the test suite' }, {
      agent: parent,
      signal: new AbortController().signal,
    } as never)
    expect(spawn).toHaveBeenCalledWith(parent, {
      sessionId: expect.any(String),
      name: 'test-worker',
      prompt: [{ type: 'text', text: 'Run the test suite' }],
      signal: expect.any(AbortSignal),
    })
    expect(worker.whenIdle).toHaveBeenCalledOnce()
    expect(result).toContain('tests passed')
  })
})
