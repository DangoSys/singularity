import { randomUUID } from "node:crypto";
import { Context, Service } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";
import { cleanPromptText } from "@dangosys/dsh-env-builder";
import { DEFAULT_ROOT } from "@dangosys/dsh-singularity-layout";

//#region src/service/state.ts
function copy(value) {
	return structuredClone(value);
}
var GraphsState = class GraphsState {
	value;
	constructor(snapshot) {
		if (snapshot === void 0) {
			this.value = {
				version: 1,
				graphs: [],
				archives: []
			};
			return;
		}
		const next = copy(snapshot);
		this.value = {
			...next,
			archives: next.archives ?? [],
			graphs: next.graphs.map((g) => {
				return g.ready === void 0 ? {
					...g,
					ready: false
				} : g;
			})
		};
	}
	clone() {
		return new GraphsState(this.value);
	}
	snapshot() {
		return copy(this.value);
	}
	apply(event) {
		switch (event.kind) {
			case "graph/add": {
				const graph = event.graph.ready === void 0 ? {
					...event.graph,
					ready: false
				} : event.graph;
				if (this.value.graphs.some((g) => g.id === graph.id)) throw new Error(`graphs: duplicate graph id "${graph.id}"`);
				if (this.value.graphs.some((g) => g.envId === graph.envId)) throw new Error(`graphs: environment "${graph.envId}" already bound`);
				this.value = {
					...this.value,
					graphs: [...this.value.graphs, copy(graph)],
					selectedId: graph.id
				};
				return;
			}
			case "graph/select":
				if (!this.value.graphs.some((g) => g.id === event.id)) throw new Error(`graphs: unknown graph "${event.id}"`);
				this.value = {
					...this.value,
					selectedId: event.id
				};
				return;
			case "graph/ready": {
				const idx = this.value.graphs.findIndex((g) => g.id === event.id);
				if (idx < 0) throw new Error(`graphs: unknown graph "${event.id}"`);
				const graph = this.value.graphs[idx];
				if (graph.ready) throw new Error(`graphs: graph "${event.id}" is already ready`);
				const next = {
					...graph,
					ready: true
				};
				const graphs = [...this.value.graphs];
				graphs[idx] = next;
				this.value = {
					...this.value,
					graphs
				};
				return;
			}
			case "graph/remove": {
				if (!this.value.graphs.some((g) => g.id === event.id)) throw new Error(`graphs: unknown graph "${event.id}"`);
				const graphs = this.value.graphs.filter((g) => g.id !== event.id);
				const selectedId = this.value.selectedId === event.id ? graphs[0]?.id : this.value.selectedId;
				this.value = {
					...this.value,
					graphs,
					selectedId,
					archives: [...this.value.archives, copy(event.archive)]
				};
				return;
			}
			default: throw new Error(`graphs: unknown event kind "${event.kind}"`);
		}
	}
	get(id) {
		const graph = this.value.graphs.find((g) => g.id === id);
		if (graph === void 0) throw new Error(`graphs: unknown graph "${id}"`);
		return copy(graph);
	}
	selected() {
		if (this.value.selectedId === void 0) return void 0;
		return this.get(this.value.selectedId);
	}
	boundEnvIds() {
		return new Set(this.value.graphs.map((g) => g.envId));
	}
};

//#endregion
//#region src/index.ts
function nextGraphId(existing) {
	let n = 1;
	while (existing.includes(`graph${n}`)) n += 1;
	return `graph${n}`;
}
var GraphsService = class extends Service {
	static inject = [
		"sessionPersistence",
		"graph",
		"layout",
		"agentRuntime",
		"envBuilder"
	];
	ready;
	storeId = SessionId("graphs-registry");
	handle;
	state = new GraphsState();
	nextSeq = 0;
	writes = Promise.resolve();
	constructor(ctx) {
		super(ctx, "graphs");
		this.ready = this.open(ctx);
		ctx.effect(() => () => this.ready.then(() => this.handle?.close()), "graphs:persistence");
		ctx.effect(async () => {
			await this.ready;
			const selected = this.state.selected();
			if (selected !== void 0) await this.activate(selected);
			return () => {};
		}, "graphs: boot selected");
	}
	async snapshot() {
		await this.ready;
		return this.state.snapshot();
	}
	async current() {
		await this.ready;
		const selected = this.state.selected();
		if (selected === void 0) throw new Error("graphs: no graph selected");
		return selected;
	}
	async list() {
		await this.ready;
		return this.state.snapshot().graphs;
	}
	async select(id) {
		await this.commit([{
			kind: "graph/select",
			id
		}]);
		const graph = this.state.get(id);
		await this.activate(graph);
		return graph;
	}
	async create(request) {
		await this.ready;
		let createdEnvId;
		try {
			const envId = await this.resolveEnv(request);
			if (request.createEnv === true) createdEnvId = envId;
			const id = nextGraphId(this.state.snapshot().graphs.map((g) => g.id));
			const name = request.name?.trim() || id;
			if (name.length === 0) throw new Error("graphs: name is empty");
			const rootSessionId = SessionId(randomUUID());
			const graphStoreId = `sg-g-${id}`;
			const layoutStoreId = `sg-l-${id}`;
			await this.ctx.graph.switchStore(graphStoreId);
			await this.ctx.layout.switchStore(layoutStoreId);
			const handle = await this.ctx.agentRuntime.createRoot({ sessionId: rootSessionId });
			await this.ctx.layout.set(handle.agent.id, DEFAULT_ROOT);
			this.ctx.envBuilder.store.attachSession(envId, handle.agent.id);
			this.ctx.envBuilder.store.select(envId);
			const graph = {
				id,
				name,
				envId,
				rootSessionId: handle.agent.id,
				graphStoreId,
				layoutStoreId,
				createdAt: Date.now(),
				ready: false
			};
			await this.commit([{
				kind: "graph/add",
				graph
			}]);
			this.ctx.emit("graphs/selected", graph);
			return graph;
		} catch (error) {
			if (createdEnvId !== void 0) this.ctx.envBuilder.store.delete(createdEnvId);
			throw error;
		}
	}
	async markReady(id) {
		await this.ready;
		const graph = id === void 0 ? await this.current() : this.state.get(id);
		await this.commit([{
			kind: "graph/ready",
			id: graph.id
		}]);
		return this.state.get(graph.id);
	}
	async remove(id) {
		await this.ready;
		const graph = this.state.get(id);
		await this.ctx.graph.switchStore(graph.graphStoreId);
		await this.ctx.layout.switchStore(graph.layoutStoreId);
		const root = await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId);
		const cleanSessionId = SessionId(randomUUID());
		const cleaned = new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				stop();
				reject(/* @__PURE__ */ new Error(`graphs: env clean timed out for "${graph.envId}"`));
			}, 600 * 1e3);
			const stop = this.ctx.on("envBuilder/cleaned", (envId) => {
				if (envId !== graph.envId) return;
				clearTimeout(timer);
				stop();
				resolve();
			});
		});
		await this.ctx.agentRuntime.spawn(root.agent, {
			sessionId: cleanSessionId,
			name: "env-clean",
			prompt: [{
				type: "text",
				text: cleanPromptText(graph.envId)
			}]
		});
		await cleaned;
		const agentIds = (await this.ctx.graph.snapshot()).agents.map((agent) => agent.id);
		await this.ctx.agentRuntime.stopAgents(agentIds);
		const archive = {
			graph,
			agentIds,
			archivedAt: Date.now()
		};
		await this.commit([{
			kind: "graph/remove",
			id,
			archive
		}]);
		const selected = this.state.selected();
		if (selected !== void 0) await this.activate(selected);
	}
	async resolveEnv(request) {
		if ([request.createEnv === true, request.envId !== void 0].filter(Boolean).length !== 1) throw new Error("graphs: provide exactly one of createEnv, envId");
		const bound = this.state.boundEnvIds();
		if (request.createEnv === true) {
			if (request.repos !== void 0 && !Array.isArray(request.repos)) throw new Error("graphs: repos must be an array");
			const env = this.ctx.envBuilder.store.create();
			for (const ref of request.repos ?? []) {
				if (typeof ref !== "string" || ref.trim().length === 0) throw new Error("graphs: empty repo ref");
				this.ctx.envBuilder.store.planComponent(env.id, ref);
			}
			return env.id;
		}
		if (request.repos !== void 0) throw new Error("graphs: repos only allowed with createEnv");
		const envId = request.envId;
		if (bound.has(envId)) throw new Error(`graphs: environment "${envId}" already bound`);
		if (this.ctx.envBuilder.store.get(envId).sessionIds.length > 0) throw new Error(`graphs: environment "${envId}" still has sessions; delete the bound graph first`);
		return envId;
	}
	async activate(graph) {
		await this.ctx.graph.switchStore(graph.graphStoreId);
		await this.ctx.layout.switchStore(graph.layoutStoreId);
		await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId);
		this.ctx.envBuilder.store.select(graph.envId);
		this.ctx.emit("graphs/selected", graph);
		this.ctx.emit("graph/change", await this.ctx.graph.snapshot());
		this.ctx.emit("layout/change", await this.ctx.layout.snapshot());
	}
	async commit(events) {
		if (events.length === 0) throw new Error("graphs: cannot commit an empty event batch");
		const run = this.writes.then(async () => {
			await this.ready;
			const next = this.state.clone();
			for (const event of events) next.apply(event);
			const records = events.map((event, index) => ({
				type: "graphs/event",
				seq: SessionSeq(this.nextSeq + index),
				time: Date.now(),
				data: event,
				ignorable: true
			}));
			await this.handle.append(records);
			this.state = next;
			this.nextSeq += records.length;
			this.ctx.emit("graphs/change", this.state.snapshot());
		});
		this.writes = run;
		return run;
	}
	async open(ctx) {
		const listed = (await ctx.sessionPersistence.list()).filter((item) => item.header.id === this.storeId);
		if (listed.length > 1) throw new Error(`graphs: duplicate store session "${this.storeId}"`);
		this.handle = listed.length === 0 ? await ctx.sessionPersistence.create(this.header()) : await ctx.sessionPersistence.open(this.storeId, "write");
		const { events } = await this.handle.read();
		for (const event of events) {
			if (event.type !== "graphs/event" || event.ignorable !== true) throw new Error(`graphs: invalid persisted event at seq ${event.seq}`);
			const stored = event;
			const next = this.state.clone();
			next.apply(stored.data);
			this.state = next;
			this.nextSeq = event.seq + 1;
		}
		await this.handle.flush();
	}
	header() {
		return {
			version: SESSION_FORMAT_VERSION,
			id: this.storeId,
			createdAt: Date.now(),
			isSeeded: false
		};
	}
};
var src_default = GraphsService;

//#endregion
export { GraphsService, GraphsState, src_default as default };