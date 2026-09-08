/**
 * Singularity root agent extras: env create tool.
 * @module dsh-singularity-agent
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@dangosys/dsh-env-builder'
import type {} from '@dangosys/dsh-singularity-agent-runtime'
import type {} from '@dangosys/dsh-singularity-layout'
import { defineEnvCreateTool } from './tools/env-create.ts'

export class SingularityAgent extends Service {
  static inject = ['tools', 'envBuilder', 'agentRuntime', 'layout']

  constructor(ctx: Context) {
    super(ctx, 'singularityAgent')
    ctx.tools.register(defineEnvCreateTool(ctx))
  }
}

export default SingularityAgent
