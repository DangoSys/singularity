import { randomUUID } from "node:crypto";
import { Context, Service } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";
import { cleanPromptText } from "@dangosys/dsh-env-builder";

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
		this.value = copy(snapshot);
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
				const graph = event.graph;
				if (typeof graph.ready !== "boolean") throw new Error("graphs: ready must be boolean");
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
//#region src/prompts/setup.prompts.ts
function setupPromptText(graphId, env) {
	const repositories = env.components.map((component) => `${component.owner}/${component.repo}`).join(", ");
	return `Set up Singularity graph ${graphId}. Environment ${env.id} is at ${env.path}.
Planned repositories: ${repositories || "(none)"}.

For each planned repository, delegate installation and registration to a worker. The worker must install it with bash according to the repository instructions and then call env_register_component. If a worker needs human input, you may use hitl_ask or hitl_approve. When all setup workers complete successfully, call graph_mark_ready. If there are no planned repositories, call graph_mark_ready immediately.`;
}

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
	transitions = Promise.resolve();
	constructor(ctx) {
		super(ctx, "graphs");
		this.ready = this.open(ctx);
		ctx.on("agentRuntime/spawned", async ({ parentId, sessionId }) => {
			const graph = await this.graphForSession(parentId);
			ctx.envBuilder.store.attachSession(graph.envId, sessionId);
		});
		ctx.effect(() => async () => {
			await this.ready;
			await this.transitions;
			await this.writes;
			await this.handle?.close();
		}, "graphs:persistence");
		ctx.effect(async () => {
			await this.ready;
			const selected = this.state.selected();
			if (selected !== void 0) await this.transition(() => this.activate(selected));
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
	async get(id) {
		await this.ready;
		return this.state.get(id);
	}
	async view(id) {
		const meta = await this.get(id);
		return {
			meta,
			graph: await this.ctx.graph.snapshotIn(meta.graphStoreId),
			layout: await this.ctx.layout.snapshotIn(meta.layoutStoreId)
		};
	}
	async list() {
		await this.ready;
		return this.state.snapshot().graphs;
	}
	async select(id) {
		return this.transition(async () => {
			const graph = await this.get(id);
			await this.activate(graph);
			await this.commit([{
				kind: "graph/select",
				id
			}]);
			return graph;
		});
	}
	async create(request) {
		return this.transition(async () => {
			await this.ready;
			let createdEnvId;
			let attached;
			let rootAgentId;
			let committed = false;
			try {
				if (request.createEnv === true === (request.envId !== void 0)) throw new Error("graphs: provide exactly one of createEnv, envId");
				let envId;
				if (request.createEnv === true) {
					if (request.repos === void 0 || request.repos.length === 0) throw new Error("graphs: new environment requires at least one repository");
					envId = createdEnvId = this.ctx.envBuilder.store.create().id;
					for (const ref of request.repos) this.ctx.envBuilder.store.planComponent(envId, ref);
				} else {
					if (request.repos !== void 0) throw new Error("graphs: repos only allowed with createEnv");
					envId = request.envId;
					if (this.state.boundEnvIds().has(envId)) throw new Error(`graphs: environment "${envId}" already bound`);
					const env$1 = this.ctx.envBuilder.store.get(envId);
					if (env$1.components.length === 0) throw new Error(`graphs: environment "${envId}" has no repositories`);
					if (env$1.sessionIds.length > 0) throw new Error(`graphs: environment "${envId}" still has sessions`);
				}
				const registry = this.state.snapshot();
				const id = nextGraphId([...registry.graphs.map((graph$1) => graph$1.id), ...registry.archives.map((archive) => archive.graph.id)]);
				const name = request.name === void 0 ? id : request.name.trim();
				if (name.length === 0) throw new Error("graphs: name is empty");
				const rootSessionId = SessionId(randomUUID());
				const graphStoreId = `sg-g-${rootSessionId}`;
				const layoutStoreId = `sg-l-${rootSessionId}`;
				const handle = await this.ctx.agentRuntime.createRoot({
					sessionId: rootSessionId,
					cwd: this.ctx.envBuilder.store.get(envId).path,
					scope: {
						graphStoreId,
						layoutStoreId
					}
				});
				rootAgentId = handle.agent.id;
				this.ctx.envBuilder.store.attachSession(envId, handle.agent.id);
				attached = {
					envId,
					sessionId: handle.agent.id
				};
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
				committed = true;
				await this.activate(graph);
				const env = this.ctx.envBuilder.store.get(envId);
				await this.ctx.agentRuntime.prompt(handle.agent, [{
					type: "text",
					text: setupPromptText(id, env)
				}]);
				return graph;
			} catch (error) {
				if (committed) throw error;
				if (attached !== void 0) {
					await this.ctx.agentRuntime.stopAgents([attached.sessionId]);
					this.ctx.envBuilder.store.detachSession(attached.envId, attached.sessionId);
				} else if (rootAgentId !== void 0) await this.ctx.agentRuntime.stopAgents([rootAgentId]);
				if (createdEnvId !== void 0) this.ctx.envBuilder.store.delete(createdEnvId);
				throw error;
			}
		});
	}
	async markReady(id) {
		await this.ready;
		await this.commit([{
			kind: "graph/ready",
			id
		}]);
		return this.state.get(id);
	}
	async graphForSession(sessionId) {
		await this.ready;
		for (const graph of this.state.snapshot().graphs) if ((await this.ctx.graph.snapshotIn(graph.graphStoreId)).agents.some((agent) => agent.id === sessionId)) return graph;
		throw new Error(`graphs: session "${sessionId}" is not in a graph`);
	}
	async remove(id) {
		return this.transition(async () => {
			const graph = await this.get(id);
			const scope = {
				graphStoreId: graph.graphStoreId,
				layoutStoreId: graph.layoutStoreId
			};
			await this.ctx.agentRuntime.stopGraph(scope);
			const root = await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId, {
				graphStoreId: graph.graphStoreId,
				layoutStoreId: graph.layoutStoreId
			});
			let stop;
			let timer;
			const cleaned = new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`graphs: env clean timed out for "${graph.envId}"`)), 600 * 1e3);
				stop = this.ctx.on("envBuilder/cleaned", (envId) => {
					if (envId === graph.envId) resolve();
				});
			});
			try {
				await Promise.all([this.ctx.agentRuntime.spawn(root.agent, {
					sessionId: SessionId(randomUUID()),
					name: "env-clean",
					prompt: [{
						type: "text",
						text: cleanPromptText(graph.envId)
					}]
				}), cleaned]);
			} finally {
				clearTimeout(timer);
				stop();
				await this.ctx.agentRuntime.stopGraph(scope);
			}
			const archive = {
				graph,
				agentIds: (await this.ctx.graph.snapshotIn(graph.graphStoreId)).agents.map((agent) => agent.id),
				archivedAt: Date.now()
			};
			await this.commit([{
				kind: "graph/remove",
				id,
				archive
			}]);
			const selected = this.state.selected();
			if (selected !== void 0) await this.activate(selected);
			else {
				this.ctx.graph.clearActive();
				this.ctx.layout.clearActive();
			}
		});
	}
	async activate(graph) {
		await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId, {
			graphStoreId: graph.graphStoreId,
			layoutStoreId: graph.layoutStoreId
		});
		await this.ctx.graph.switchStore(graph.graphStoreId);
		await this.ctx.layout.switchStore(graph.layoutStoreId);
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
		this.writes = run.then(() => void 0, () => void 0);
		return run;
	}
	transition(work) {
		const run = this.transitions.then(work);
		this.transitions = run.then(() => void 0, () => void 0);
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