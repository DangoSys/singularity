import type { ServerResponse } from 'node:http'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { GraphSnapshot } from '@dangosys/dsh-singularity-graph'

export class GraphBroadcast {
  readonly clients = new Set<ServerResponse>()
  readonly notices = new Set<ServerResponse>()
  private previousStatuses = new Map<SessionId, GraphSnapshot['agents'][number]['status']>()

  publishEvent(name: string, value: unknown): void {
    const frame = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`
    for (const res of this.clients) {
      if (res.destroyed) this.clients.delete(res)
      else res.write(frame)
    }
  }

  publish(snapshot: GraphSnapshot): void {
    const frame = `event: graph\ndata: ${JSON.stringify(snapshot)}\n\n`
    for (const res of this.clients) {
      if (res.destroyed) this.clients.delete(res)
      else res.write(frame)
    }
    for (const agent of snapshot.agents) {
      const previous = this.previousStatuses.get(agent.id)
      const complete = previous === 'running' && agent.status === 'idle'
      const text = complete
        ? '已完成当前任务'
        : agent.status === 'done'
          ? '任务已完成'
          : agent.status === 'failed'
            ? '任务执行失败'
            : agent.status === 'waiting'
              ? '正在等待处理'
              : undefined
      if (text === undefined || previous === agent.status) continue
      const notice = `event: notice\ndata: ${JSON.stringify({ agentId: agent.id, status: agent.status, text })}\n\n`
      for (const res of this.notices) {
        if (res.destroyed) this.notices.delete(res)
        else res.write(notice)
      }
    }
    this.previousStatuses = new Map(snapshot.agents.map(agent => [agent.id, agent.status]))
  }

  close(): void {
    for (const res of this.clients) res.end()
    this.clients.clear()
    for (const res of this.notices) res.end()
    this.notices.clear()
  }
}
