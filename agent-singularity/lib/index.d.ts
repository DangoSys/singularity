import { Context, Service } from "@deepseek-ai/cordis";

//#region src/index.d.ts

declare class SingularityAgent extends Service {
  static inject: string[];
  constructor(ctx: Context);
}
//#endregion
export { SingularityAgent, SingularityAgent as default };