import type { GraphsEvent, GraphsSnapshot, GraphRecord } from '../types.ts'

function copy<T>(value: T): T {
  return structuredClone(value)
}

export class GraphsState {
  private value: GraphsSnapshot

  constructor(snapshot?: GraphsSnapshot) {
    if (snapshot === undefined) {
      this.value = { version: 1, graphs: [], archives: [] }
      return
    }
    const next = copy(snapshot)
    this.value = {
      ...next,
      archives: next.archives ?? [],
      graphs: next.graphs.map(g => {
        const ready = (g as GraphRecord & { ready?: boolean }).ready
        return ready === undefined ? { ...g, ready: false } : g
      }),
    }
  }

  clone(): GraphsState {
    return new GraphsState(this.value)
  }

  snapshot(): GraphsSnapshot {
    return copy(this.value)
  }

  apply(event: GraphsEvent): void {
    switch (event.kind) {
      case 'graph/add': {
        const graph = (event.graph as GraphRecord & { ready?: boolean }).ready === undefined
          ? { ...event.graph, ready: false }
          : event.graph
        if (this.value.graphs.some(g => g.id === graph.id)) {
          throw new Error(`graphs: duplicate graph id "${graph.id}"`)
        }
        if (this.value.graphs.some(g => g.envId === graph.envId)) {
          throw new Error(`graphs: environment "${graph.envId}" already bound`)
        }
        this.value = {
          ...this.value,
          graphs: [...this.value.graphs, copy(graph)],
          selectedId: graph.id,
        }
        return
      }
      case 'graph/select': {
        if (!this.value.graphs.some(g => g.id === event.id)) {
          throw new Error(`graphs: unknown graph "${event.id}"`)
        }
        this.value = { ...this.value, selectedId: event.id }
        return
      }
      case 'graph/ready': {
        const idx = this.value.graphs.findIndex(g => g.id === event.id)
        if (idx < 0) throw new Error(`graphs: unknown graph "${event.id}"`)
        const graph = this.value.graphs[idx]
        if (graph.ready) throw new Error(`graphs: graph "${event.id}" is already ready`)
        const next = { ...graph, ready: true }
        const graphs = [...this.value.graphs]
        graphs[idx] = next
        this.value = { ...this.value, graphs }
        return
      }
      case 'graph/remove': {
        if (!this.value.graphs.some(g => g.id === event.id)) {
          throw new Error(`graphs: unknown graph "${event.id}"`)
        }
        const graphs = this.value.graphs.filter(g => g.id !== event.id)
        const selectedId = this.value.selectedId === event.id
          ? graphs[0]?.id
          : this.value.selectedId
        this.value = {
          ...this.value,
          graphs,
          selectedId,
          archives: [...this.value.archives, copy(event.archive)],
        }
        return
      }
      default:
        throw new Error(`graphs: unknown event kind "${(event as { kind?: unknown }).kind}"`)
    }
  }

  get(id: string): GraphRecord {
    const graph = this.value.graphs.find(g => g.id === id)
    if (graph === undefined) throw new Error(`graphs: unknown graph "${id}"`)
    return copy(graph)
  }

  selected(): GraphRecord | undefined {
    if (this.value.selectedId === undefined) return undefined
    return this.get(this.value.selectedId)
  }

  boundEnvIds(): Set<string> {
    return new Set(this.value.graphs.map(g => g.envId))
  }
}
