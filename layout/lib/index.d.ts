import { Context, Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/types.d.ts
type NodeShape = 'card' | 'circle' | 'diamond';
interface CanvasNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shape: NodeShape;
}
interface LayoutSnapshot {
  readonly version: 1;
  readonly id: string;
  readonly nodes: Readonly<Record<string, CanvasNode>>;
}
type LayoutEvent = {
  readonly kind: 'node/set';
  readonly sessionId: SessionId;
  readonly node: CanvasNode;
} | {
  readonly kind: 'node/remove';
  readonly sessionId: SessionId;
};
interface LayoutConfig {
  readonly storeId?: string;
}
declare const DEFAULT_ROOT: CanvasNode;
//#endregion
//#region src/service/state.d.ts
declare class LayoutState {
  private value;
  constructor(id: string, snapshot?: LayoutSnapshot);
  clone(): LayoutState;
  snapshot(): LayoutSnapshot;
  get(sessionId: SessionId): CanvasNode;
  apply(event: LayoutEvent): void;
}
//#endregion
//#region src/index.d.ts
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'layout/event': LayoutEvent;
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    layout: LayoutService;
  }
  interface Events {
    'layout/change'(snapshot: LayoutSnapshot): void;
  }
}
declare class LayoutService extends Service {
  static inject: string[];
  private readonly entries;
  private activeId?;
  private closing;
  constructor(ctx: Context, config?: LayoutConfig);
  switchStore(id: string): Promise<LayoutSnapshot>;
  clearActive(): void;
  snapshot(): Promise<LayoutSnapshot>;
  snapshotIn(id: string): Promise<LayoutSnapshot>;
  set(sessionId: SessionId, node: CanvasNode): Promise<void>;
  setIn(id: string, sessionId: SessionId, node: CanvasNode): Promise<void>;
  remove(sessionId: SessionId): Promise<void>;
  removeIn(id: string, sessionId: SessionId): Promise<void>;
  commit(events: readonly LayoutEvent[]): Promise<void>;
  commitIn(id: string, events: readonly LayoutEvent[]): Promise<void>;
  private active;
  private activeIdOf;
  private entry;
  private openEntry;
  private open;
  private close;
  private header;
}
//#endregion
export { CanvasNode, DEFAULT_ROOT, LayoutConfig, LayoutEvent, LayoutService, LayoutService as default, LayoutSnapshot, LayoutState, NodeShape };