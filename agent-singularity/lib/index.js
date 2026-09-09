import { Context, Service } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { defineTool } from "@deepseek-ai/dsh-tools";

//#region src/hitl.ts
var HitlService = class extends Service {
	waiters = /* @__PURE__ */ new Map();
	constructor(ctx) {
		super(ctx, "hitl");
	}
	list() {
		return [...this.waiters.values()].map((w) => w.pending);
	}
	ask(sessionId$2, prompt) {
		if (prompt.trim().length === 0) throw new Error("hitl: ask prompt is empty");
		return this.enqueue(sessionId$2, "ask", prompt).then((answer) => {
			if (answer.kind !== "ask") throw new Error("hitl: expected ask answer");
			return answer.text;
		});
	}
	approve(sessionId$2, prompt) {
		if (prompt.trim().length === 0) throw new Error("hitl: approve prompt is empty");
		return this.enqueue(sessionId$2, "approve", prompt).then((answer) => {
			if (answer.kind !== "approve") throw new Error("hitl: expected approve answer");
			return answer.decision;
		});
	}
	answer(id, answer) {
		const waiter = this.waiters.get(id);
		if (waiter === void 0) throw new Error(`hitl: unknown request "${id}"`);
		if (waiter.pending.kind !== answer.kind) throw new Error(`hitl: kind mismatch for "${id}"`);
		if (answer.kind === "ask" && answer.text.trim().length === 0) throw new Error("hitl: empty ask answer");
		this.waiters.delete(id);
		waiter.resolve(answer);
		this.ctx.emit("hitl/change", this.list());
	}
	enqueue(sessionId$2, kind, prompt) {
		if (typeof sessionId$2 !== "string" || sessionId$2.length === 0) throw new Error("hitl: missing session id");
		const id = randomUUID();
		const pending = {
			id,
			kind,
			prompt,
			sessionId: sessionId$2,
			createdAt: Date.now()
		};
		const promise = new Promise((resolve, reject) => {
			this.waiters.set(id, {
				pending,
				resolve,
				reject
			});
		});
		this.ctx.emit("hitl/change", this.list());
		return promise;
	}
};

//#endregion
//#region src/tools/approve.ts
const text$3 = (value) => [{
	type: "text",
	text: value
}];
function sessionId$1(exec) {
	const id = exec.agent?.id;
	if (typeof id !== "string" || id.length === 0) throw new Error("hitl_approve: missing agent id");
	return id;
}
function defineApproveTool(ctx) {
	return defineTool({
		name: "hitl_approve",
		description: "Request human approve/reject and wait. Use before irreversible or sensitive actions.",
		parameters: { prompt: {
			type: "string",
			required: true,
			description: "Approval request shown to the human"
		} },
		output: {
			schema: { type: "string" },
			render: (_a, v) => text$3(v)
		},
		execute: async (args, exec) => {
			return await ctx.hitl.approve(sessionId$1(exec), args.prompt);
		}
	});
}

//#endregion
//#region src/tools/ask.ts
const text$2 = (value) => [{
	type: "text",
	text: value
}];
function sessionId(exec) {
	const id = exec.agent?.id;
	if (typeof id !== "string" || id.length === 0) throw new Error("hitl_ask: missing agent id");
	return id;
}
function defineAskTool(ctx) {
	return defineTool({
		name: "hitl_ask",
		description: "Ask the human a text question and wait for the answer. Use for environment setup or decisions that need human input.",
		parameters: { prompt: {
			type: "string",
			required: true,
			description: "Question shown to the human"
		} },
		output: {
			schema: { type: "string" },
			render: (_a, v) => text$2(v)
		},
		execute: async (args, exec) => {
			return await ctx.hitl.ask(sessionId(exec), args.prompt);
		}
	});
}

//#endregion
//#region src/tools/env-create.ts
const text$1 = (value) => [{
	type: "text",
	text: value
}];
function defineEnvCreateTool(ctx) {
	return defineTool({
		name: "env_create",
		description: "Deprecated. Create a Singularity graph from the Singularity UI (New graph).",
		parameters: {},
		output: {
			schema: { type: "string" },
			render: (_a, v) => text$1(v)
		},
		execute: async () => {
			throw new Error("env_create is retired: open Singularity → New graph to create a graph bound to a clean environment");
		}
	});
}

//#endregion
//#region src/tools/mark-ready.ts
const text = (value) => [{
	type: "text",
	text: value
}];
function defineMarkReadyTool(ctx) {
	return defineTool({
		name: "graph_mark_ready",
		description: "Mark the current Singularity graph ready after environment setup is complete. Required before free-form human chat.",
		parameters: {},
		output: {
			schema: { type: "string" },
			render: (_a, v) => text(v)
		},
		execute: async () => {
			return `graph ${(await ctx.graphs.markReady()).id} ready`;
		}
	});
}

//#endregion
//#region src/index.ts
var SingularityAgent = class extends Service {
	static inject = ["tools", "graphs"];
	constructor(ctx) {
		super(ctx, "singularityAgent");
		ctx.plugin(HitlService);
		ctx.tools.register(defineEnvCreateTool(ctx));
		ctx.tools.register(defineMarkReadyTool(ctx));
		ctx.tools.register(defineAskTool(ctx));
		ctx.tools.register(defineApproveTool(ctx));
	}
};
var src_default = SingularityAgent;

//#endregion
export { HitlService, SingularityAgent, src_default as default };