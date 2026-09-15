import type { EnvRecord } from '@dangosys/dsh-env-builder'

export function setupPromptText(graphId: string, env: EnvRecord): string {
  const repositories = env.components.map(component => `${component.owner}/${component.repo}`).join(', ')
  return `Set up Singularity graph ${graphId}. Environment ${env.id} is at ${env.path}.
Planned repositories: ${repositories || '(none)'}.

For each planned repository, delegate installation and registration to a worker. The worker must install it with bash according to the repository instructions and then call env_register_component. If a worker needs human input, you may use hitl_ask or hitl_approve. When all setup workers complete successfully, call graph_mark_ready. If there are no planned repositories, call graph_mark_ready immediately.`
}
