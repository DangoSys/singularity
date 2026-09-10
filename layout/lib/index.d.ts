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
declare module '@deepseek-ai/dsh-session' {
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
  private ready;
  private storeId;
  private handle;
  private state;
  private nextSeq;
  private writes;
  private active;
  constructor(ctx: Context, config?: LayoutConfig);
  switchStore(rawId: string): Promise<LayoutSnapshot>;
  snapshot(): Promise<LayoutSnapshot>;
  set(sessionId: SessionId, node: CanvasNode): Promise<void>;
  remove(sessionId: SessionId): Promise<void>;
  commit(events: readonly LayoutEvent[]): Promise<void>;
  private open;
  private header;
}
//#endregion
export { CanvasNode, DEFAULT_ROOT, LayoutConfig, LayoutEvent, LayoutService, LayoutService as default, LayoutSnapshot, LayoutState, NodeShape };