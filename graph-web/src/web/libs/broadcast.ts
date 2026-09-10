import type { ServerResponse } from 'node:http'
import type { GraphSnapshot } from '@dangosys/dsh-singularity-graph'
import type { LayoutSnapshot } from '@dangosys/dsh-singularity-layout'

export class GraphBroadcast {
  readonly clients = new Set<ServerResponse>()

  publishEvent(name: string, value: unknown): void {
    const frame = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`
    for (const res of this.clients) {
      if (res.destroyed) this.clients.delete(res)
      else res.write(frame)
    }
  }

  publishLayout(snapshot: LayoutSnapshot): void {
    this.publishEvent('layout', snapshot)
  }

  publish(snapshot: GraphSnapshot): void {
    this.publishEvent('graph', snapshot)
  }

  close(): void {
    for (const res of this.clients) res.end()
    this.clients.clear()
  }
}
