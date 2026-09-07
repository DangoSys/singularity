import { Context } from "@deepseek-ai/cordis";

//#region src/web/index.d.ts
interface PrBotPathEvent {
  readonly path: 'pr' | 'bot';
  readonly target: {
    readonly repo: string;
    readonly number: number;
  } | {
    readonly sessionId: string;
  };
}
interface PrBotSentEvent extends PrBotPathEvent {
  readonly result: unknown;
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    'pr-bot/path': (event: PrBotPathEvent) => void;
    'pr-bot/sent': (event: PrBotSentEvent) => void;
  }
}
declare const name = "graph-web";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };