import { Context } from "@deepseek-ai/cordis";

//#region src/index.d.ts

interface PrChatPathEvent {
  readonly path: 'pr' | 'bot';
  readonly target: {
    readonly repo: string;
    readonly number: number;
  } | {
    readonly sessionId: string;
  };
}
interface PrChatSentEvent extends PrChatPathEvent {
  readonly result: unknown;
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    'pr-chat/path': (event: PrChatPathEvent) => void;
    'pr-chat/sent': (event: PrChatSentEvent) => void;
  }
}
declare const name = "graph-web";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };