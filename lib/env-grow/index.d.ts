import { Context, Service } from "@deepseek-ai/cordis";

//#region src/env-grow/index.d.ts
declare class EnvGrowService extends Service {
  static inject: string[];
  constructor(ctx: Context);
  private grow;
}
//#endregion
export { EnvGrowService, EnvGrowService as default };