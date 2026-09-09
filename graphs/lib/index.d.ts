import { Context, Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/types.d.ts
interface GraphRecord {
  readonly id: string;
  readonly name: string;
  readonly envId: string;
  readonly rootSessionId: SessionId;
  readonly graphStoreId: string;
  readonly layoutStoreId: string;
  readonly createdAt: number;
  readonly ready: boolean;
}
interface GraphArchive {
  readonly graph: GraphRecord;
  readonly agentIds: readonly SessionId[];
  readonly archivedAt: number;
}
interface GraphsSnapshot {
  readonly version: 1;
  readonly graphs: readonly GraphRecord[];
  readonly selectedId?: string;
  readonly archives: readonly GraphArchive[];
}
type GraphsEvent = {
  readonly kind: 'graph/add';
  readonly graph: GraphRecord;
} | {
  readonly kind: 'graph/select';
  readonly id: string;
} | {
  readonly kind: 'graph/ready';
  readonly id: string;
} | {
  readonly kind: 'graph/remove';
  readonly id: string;
  readonly archive: GraphArchive;
};
interface CreateGraphRequest {
  readonly name?: string;
  readonly createEnv?: true;
  readonly envId?: string;
  /** Planned github owner/repo refs when createEnv is set. Cloned later by env agents. */
  readonly repos?: readonly string[];
}
//#endregion
//#region src/service/state.d.ts
declare class GraphsState {
  private value;
  constructor(snapshot?: GraphsSnapshot);
  clone(): GraphsState;
  snapshot(): GraphsSnapshot;
  apply(event: GraphsEvent): void;
  get(id: string): GraphRecord;
  selected(): GraphRecord | undefined;
  boundEnvIds(): Set<string>;
}
//#endregion
//#region src/index.d.ts
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'graphs/event': GraphsEvent;
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    graphs: GraphsService;
  }
  interface Events {
    'graphs/change'(snapshot: GraphsSnapshot): void;
    'graphs/selected'(graph: GraphRecord): void;
  }
}
declare class GraphsService extends Service {
  static inject: string[];
  private readonly ready;
  private readonly storeId;
  private handle;
  private state;
  private nextSeq;
  private writes;
  constructor(ctx: Context);
  snapshot(): Promise<GraphsSnapshot>;
  current(): Promise<GraphRecord>;
  list(): Promise<readonly GraphRecord[]>;
  select(id: string): Promise<GraphRecord>;
  create(request: CreateGraphRequest): Promise<GraphRecord>;
  markReady(id?: string): Promise<GraphRecord>;
  remove(id: string): Promise<void>;
  private resolveEnv;
  private activate;
  private commit;
  private open;
  private header;
}
//#endregion
export { CreateGraphRequest, GraphArchive, GraphRecord, GraphsEvent, GraphsService, GraphsService as default, GraphsSnapshot, GraphsState };