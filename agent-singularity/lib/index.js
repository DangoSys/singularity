import { Context, Service } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { DEFAULT_ROOT } from "@dangosys/dsh-singularity-layout";

//#region src/tools/env-create.ts
const text = (value) => [{
	type: "text",
	text: value
}];
function defineEnvCreateTool(ctx) {
	return defineTool({
		name: "env_create",
		description: "Create an environment and promote the current singularity agent to the canvas root. Humans must not call env-builder create directly.",
		parameters: {},
		output: {
			schema: { type: "string" },
			render: (_a, v) => text(v)
		},
		execute: async (_args, exec) => {
			if (exec.agent === void 0) throw new Error("env_create: requires an agent initiator");
			const agent = exec.agent;
			const env = ctx.envBuilder.store.create();
			await ctx.agentRuntime.promoteRoot(agent);
			await ctx.layout.set(agent.id, DEFAULT_ROOT);
			ctx.envBuilder.store.attachSession(env.id, agent.id);
			ctx.envBuilder.store.select(env.id);
			return JSON.stringify({
				env,
				sessionId: agent.id
			});
		}
	});
}

//#endregion
//#region src/index.ts
var SingularityAgent = class extends Service {
	static inject = [
		"tools",
		"envBuilder",
		"agentRuntime",
		"layout"
	];
	constructor(ctx) {
		super(ctx, "singularityAgent");
		ctx.tools.register(defineEnvCreateTool(ctx));
	}
};
var src_default = SingularityAgent;

//#endregion
export { SingularityAgent, src_default as default };