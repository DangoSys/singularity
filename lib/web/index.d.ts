import { Context } from "@deepseek-ai/cordis";

//#region src/web/index.d.ts
declare const name = "graph-web";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };