/**
 * Singularity root agent extras.
 * @module dsh-singularity-agent
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@dangosys/dsh-singularity-graphs'
import type {} from '@dangosys/dsh-singularity-agent-runtime'
import { HitlService } from './hitl.ts'
import { defineApproveTool } from './tools/approve.ts'
import { defineAskTool } from './tools/ask.ts'
import { defineMarkReadyTool } from './tools/mark-ready.ts'
import { defineSpawnTool } from './tools/spawn.ts'

export { HitlService } from './hitl.ts'
export type { HitlAnswer, HitlKind, HitlPending } from './hitl.ts'

export class SingularityAgent extends Service {
  static inject = ['tools', 'graphs', 'agentRuntime']

  constructor(ctx: Context) {
    super(ctx, 'singularityAgent')
    ctx.plugin(HitlService)
    ctx.tools.register(defineMarkReadyTool(ctx))
    ctx.tools.register(defineSpawnTool(ctx))
    ctx.tools.register(defineAskTool(ctx))
    ctx.tools.register(defineApproveTool(ctx))
  }
}

export default SingularityAgent
