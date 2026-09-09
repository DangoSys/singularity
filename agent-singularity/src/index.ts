/**
 * Singularity root agent extras.
 * @module dsh-singularity-agent
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@dangosys/dsh-singularity-graphs'
import { HitlService } from './hitl.ts'
import { defineApproveTool } from './tools/approve.ts'
import { defineAskTool } from './tools/ask.ts'
import { defineEnvCreateTool } from './tools/env-create.ts'
import { defineMarkReadyTool } from './tools/mark-ready.ts'

export { HitlService } from './hitl.ts'
export type { HitlAnswer, HitlKind, HitlPending } from './hitl.ts'

export class SingularityAgent extends Service {
  static inject = ['tools', 'graphs']

  constructor(ctx: Context) {
    super(ctx, 'singularityAgent')
    ctx.plugin(HitlService)
    ctx.tools.register(defineEnvCreateTool(ctx))
    ctx.tools.register(defineMarkReadyTool(ctx))
    ctx.tools.register(defineAskTool(ctx))
    ctx.tools.register(defineApproveTool(ctx))
  }
}

export default SingularityAgent
