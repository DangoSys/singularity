import { Context, Service } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/hitl.ts
var HitlService = class extends Service {
	waiters = /* @__PURE__ */ new Map();
	lifetime = new AbortController();
	constructor(ctx) {
		super(ctx, "hitl");
		ctx.effect(() => () => this.lifetime.abort(/* @__PURE__ */ new Error("hitl: service disposed")), "hitl: waiters");
	}
	list() {
		return [...this.waiters.values()].map((w) => w.pending);
	}
	ask(sessionId$2, prompt, signal) {
		if (prompt.trim().length === 0) throw new Error("hitl: ask prompt is empty");
		return this.enqueue(sessionId$2, "ask", prompt, signal).then((answer) => {
			if (answer.kind !== "ask") throw new Error("hitl: expected ask answer");
			return answer.text;
		});
	}
	approve(sessionId$2, prompt, signal) {
		if (prompt.trim().length === 0) throw new Error("hitl: approve prompt is empty");
		return this.enqueue(sessionId$2, "approve", prompt, signal).then((answer) => {
			if (answer.kind !== "approve") throw new Error("hitl: expected approve answer");
			return answer.decision;
		});
	}
	answer(id, answer) {
		const waiter = this.waiters.get(id);
		if (waiter === void 0) throw new Error(`hitl: unknown request "${id}"`);
		if (waiter.pending.kind !== answer.kind) throw new Error(`hitl: kind mismatch for "${id}"`);
		if (answer.kind === "ask" && answer.text.trim().length === 0) throw new Error("hitl: empty ask answer");
		if (answer.kind === "approve" && answer.decision !== "approve" && answer.decision !== "reject") throw new Error("hitl: invalid approval decision");
		waiter.dispose();
		this.waiters.delete(id);
		waiter.resolve(answer);
		this.ctx.emit("hitl/change", this.list());
	}
	enqueue(sessionId$2, kind, prompt, callerSignal) {
		const signal = AbortSignal.any([callerSignal, this.lifetime.signal]);
		signal.throwIfAborted();
		if (typeof sessionId$2 !== "string" || sessionId$2.length === 0) throw new Error("hitl: missing session id");
		const id = randomUUID();
		const pending = {
			id,
			kind,
			prompt,
			sessionId: sessionId$2,
			createdAt: Date.now()
		};
		const abort = () => {
			this.waiters.get(id).reject(signal.reason);
			this.waiters.delete(id);
			this.ctx.emit("hitl/change", this.list());
		};
		const promise = new Promise((resolve, reject) => {
			this.waiters.set(id, {
				pending,
				resolve,
				reject,
				dispose: () => signal.removeEventListener("abort", abort)
			});
			signal.addEventListener("abort", abort, { once: true });
		});
		this.ctx.emit("hitl/change", this.list());
		return promise.finally(() => signal.removeEventListener("abort", abort));
	}
};

//#endregion
//#region src/tools/approve.ts
const text$2 = (value) => [{
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
			render: (_a, v) => text$2(v)
		},
		execute: async (args, exec) => {
			return await ctx.hitl.approve(sessionId$1(exec), args.prompt, exec.signal);
		}
	});
}

//#endregion
//#region src/tools/ask.ts
const text$1 = (value) => [{
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
			render: (_a, v) => text$1(v)
		},
		execute: async (args, exec) => {
			return await ctx.hitl.ask(sessionId(exec), args.prompt, exec.signal);
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
		execute: async (_args, exec) => {
			const sessionId$2 = exec.agent?.id;
			if (sessionId$2 === void 0) throw new Error("graph_mark_ready: missing agent id");
			const graph = await ctx.graphs.graphForSession(sessionId$2);
			await ctx.graphs.markReady(graph.id);
			return `graph ${graph.id} ready`;
		}
	});
}

//#endregion
//#region src/tools/spawn.ts
function defineSpawnTool(ctx) {
	return defineTool({
		name: "graph_spawn",
		description: "Delegate one task to a new Singularity worker node and wait for its final response.",
		parameters: {
			name: {
				type: "string",
				required: true,
				description: "Short worker name shown on the graph"
			},
			task: {
				type: "string",
				required: true,
				description: "Complete task for the worker"
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		execute: async (args, exec) => {
			const handle = await ctx.agentRuntime.spawn(exec.agent, {
				sessionId: SessionId(randomUUID()),
				name: args.name,
				prompt: [{
					type: "text",
					text: args.task
				}],
				signal: exec.signal
			});
			const cancel = () => handle.agent.cancel({ kind: "parent" });
			exec.signal.addEventListener("abort", cancel, { once: true });
			try {
				await handle.agent.whenIdle();
				exec.signal.throwIfAborted();
			} finally {
				exec.signal.removeEventListener("abort", cancel);
			}
			const event = [...handle.agent.session.snapshotEvents()].reverse().find((item) => item.type === "assistant/message");
			if (event === void 0 || event.type !== "assistant/message") throw new Error(`graph_spawn: worker ${handle.agent.id} produced no response`);
			const result = event.data.message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
			if (result.length === 0) throw new Error(`graph_spawn: worker ${handle.agent.id} produced no text response`);
			return `Worker ${handle.agent.id} completed:\n${result}`;
		}
	});
}

//#endregion
//#region src/index.ts
var SingularityAgent = class extends Service {
	static inject = [
		"tools",
		"graphs",
		"agentRuntime"
	];
	constructor(ctx) {
		super(ctx, "singularityAgent");
		ctx.plugin(HitlService);
		ctx.tools.register(defineMarkReadyTool(ctx));
		ctx.tools.register(defineSpawnTool(ctx));
		ctx.tools.register(defineAskTool(ctx));
		ctx.tools.register(defineApproveTool(ctx));
	}
};
var src_default = SingularityAgent;

//#endregion
export { HitlService, SingularityAgent, src_default as default };