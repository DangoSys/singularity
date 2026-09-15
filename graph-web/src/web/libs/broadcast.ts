import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { GraphSnapshot } from '@dangosys/dsh-singularity-graph'
import type { LayoutSnapshot } from '@dangosys/dsh-singularity-layout'
import type { GraphRecord } from '@dangosys/dsh-singularity-graphs'

export class GraphBroadcast {
  readonly clients = new Map<ServerResponse, { graph: GraphRecord; writes: Promise<void> }>()

  constructor(private readonly ctx: Context) {}

  subscribe(res: ServerResponse, graph: GraphRecord): void {
    this.clients.set(res, { graph, writes: Promise.resolve() })
    this.snapshot(res)
  }

  snapshot(res: ServerResponse): void {
    const client = this.clients.get(res)!
    client.writes = client.writes
      .then(async () => {
        const view = await this.ctx.graphs.view(client.graph.id)
        if (!res.destroyed) res.write(`event: snapshot\ndata: ${JSON.stringify(view)}\n\n`)
      })
      .catch(error => {
        this.clients.delete(res)
        res.destroy(error)
      })
  }

  publishEvent(name: string, value: unknown): void {
    const frame = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`
    for (const [res, client] of this.clients) {
      if (res.destroyed) this.clients.delete(res)
      else if (name === 'graphs') {
        const graphs = value as { graphs: GraphRecord[] }
        if (graphs.graphs.some(graph => graph.id === client.graph.id)) this.snapshot(res)
        else res.end()
      } else res.write(frame)
    }
  }

  publishLayout(snapshot: LayoutSnapshot): void {
    for (const [res, client] of this.clients) {
      if (client.graph.layoutStoreId === snapshot.id) this.snapshot(res)
    }
  }

  publish(snapshot: GraphSnapshot): void {
    for (const [res, client] of this.clients) {
      if (client.graph.graphStoreId === snapshot.id) this.snapshot(res)
    }
  }

  close(): void {
    for (const res of this.clients.keys()) res.end()
    this.clients.clear()
  }
}
