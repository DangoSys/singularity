import { Context, Service } from "@deepseek-ai/cordis";

//#region src/hitl.d.ts
type HitlKind = 'ask' | 'approve';
interface HitlPending {
  readonly id: string;
  readonly kind: HitlKind;
  readonly prompt: string;
  readonly sessionId: string;
  readonly createdAt: number;
}
type HitlAnswer = {
  readonly kind: 'ask';
  readonly text: string;
} | {
  readonly kind: 'approve';
  readonly decision: 'approve' | 'reject';
};
declare module '@deepseek-ai/cordis' {
  interface Context {
    hitl: HitlService;
  }
  interface Events {
    'hitl/change'(pending: readonly HitlPending[]): void;
  }
}
declare class HitlService extends Service {
  private readonly waiters;
  constructor(ctx: Context);
  list(): readonly HitlPending[];
  ask(sessionId: string, prompt: string): Promise<string>;
  approve(sessionId: string, prompt: string): Promise<'approve' | 'reject'>;
  answer(id: string, answer: HitlAnswer): void;
  private enqueue;
}
//#endregion
//#region src/index.d.ts
declare class SingularityAgent extends Service {
  static inject: string[];
  constructor(ctx: Context);
}
//#endregion
export { type HitlAnswer, type HitlKind, type HitlPending, HitlService, SingularityAgent, SingularityAgent as default };