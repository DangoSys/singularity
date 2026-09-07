import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { AgentRuntime, Agent } from '../agent/index.ts'
import type { CanvasNode, GraphService } from '../graph/index.ts'

interface EnvComponent {
  readonly owner: string
  readonly repo: string
  readonly dir: string
  readonly sessionId?: string
}

interface EnvStore {
  addComponent(envId: string, ref: string): Promise<string>
  get(envId: string): {
    readonly path: string
    readonly components: readonly EnvComponent[]
    readonly sessionIds: readonly string[]
  }
  bindComponentSession(envId: string, ref: string, sessionId: string): unknown
  removeComponent(envId: string, ref: string): Promise<void>
  delete(envId: string): Promise<void>
}

export class EnvGrowService extends Service {
  static inject = ['graph', 'agentRuntime', 'agents', 'envBuilder']

  constructor(ctx: Context) {
    super(ctx, 'envGrow')
    const store = ctx.get('envBuilder').store as EnvStore
    const addComponent = store.addComponent.bind(store)
    const removeComponent = store.removeComponent.bind(store)
    const deleteEnvironment = store.delete.bind(store)
    store.addComponent = async (envId, ref) => {
      const dir = await addComponent(envId, ref)
      await this.grow(envId, dir)
      return dir
    }
    store.removeComponent = async (envId, ref) => {
      const sessionId = store.get(envId).components.find(item => item.owner + '/' + item.repo === ref)?.sessionId
      await removeComponent(envId, ref)
      if (sessionId !== undefined) await this.ctx.agentRuntime.destroySession(sessionId)
    }
    store.delete = async envId => {
      const sessionIds = [...store.get(envId).sessionIds]
      await deleteEnvironment(envId)
      for (const sessionId of sessionIds) await this.ctx.agentRuntime.destroySession(sessionId)
    }
    ctx.effect(() => () => {
      store.addComponent = addComponent
      store.removeComponent = removeComponent
      store.delete = deleteEnvironment
    }, 'env-grow: add component')
  }

  private async grow(envId: string, dir: string): Promise<void> {
    const store = this.ctx.get('envBuilder').store as EnvStore
    const env = store.get(envId)
    const component = env.components.find(item => join(env.path, item.dir) === dir)
    if (component === undefined) throw new Error(`env-grow: installed component is missing from ${envId}`)

    const snapshot = await this.ctx.graph.snapshot()
    if (snapshot.roots.length !== 1) {
      throw new Error('env-grow: expected one singularity root, got ' + snapshot.roots.length)
    }
    const rootId = snapshot.roots[0]
    if (rootId === undefined) throw new Error('env-grow: singularity root is missing')
    const rootNode = snapshot.agents.find(agent => agent.id === rootId)
    if (rootNode === undefined) throw new Error(`env-grow: root agent "${rootId}" is missing from graph`)
    if (rootNode.node === undefined) throw new Error(`env-grow: root agent "${rootId}" has no canvas node`)
    const root = this.ctx.agents.get(rootId) as Agent | undefined
    if (root === undefined) throw new Error(`env-grow: root agent "${rootId}" is not live`)

    const childIndex = snapshot.agents.filter(agent => agent.id !== rootId).length
    const node = radialNode(rootNode.node, childIndex)
    const sessionId = SessionId(`component-${randomUUID()}`)
    await this.ctx.agentRuntime.spawn(root, {
      sessionId,
      name: `${component.owner}/${component.repo}`,
      prompt: [{ type: 'text', text: `Inspect the newly installed ${component.owner}/${component.repo} component.` }],
      node,
    })
    try {
      store.bindComponentSession(envId, component.owner + '/' + component.repo, sessionId)
    } catch (error) {
      await this.ctx.agentRuntime.destroySession(sessionId)
      throw error
    }
  }
}

function radialNode(root: CanvasNode, index: number): CanvasNode {
  const width = 168
  const height = 76
  const radius = 240
  const angle = -Math.PI / 2 + index * Math.PI / 3
  const centerX = root.x + root.width / 2 + Math.cos(angle) * radius
  const centerY = root.y + root.height / 2 + Math.sin(angle) * radius
  return { x: Math.round(centerX - width / 2), y: Math.round(centerY - height / 2), width, height, shape: 'card' }
}

export default EnvGrowService
