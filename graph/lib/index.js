import { Context, Service } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";

//#region src/service/state.ts
function copy(value) {
	return structuredClone(value);
}
var GraphState = class GraphState {
	value;
	constructor(id, snapshot) {
		this.value = snapshot === void 0 ? {
			version: 1,
			id,
			roots: [],
			agents: [],
			groups: [],
			edges: []
		} : copy(snapshot);
	}
	clone() {
		return new GraphState(this.value.id, this.value);
	}
	snapshot() {
		return copy(this.value);
	}
	apply(event) {
		switch (event.kind) {
			case "agent/add":
				this.addAgent(event.agent, event.root === true);
				return;
			case "agent/status":
				this.status(event.agentId, event.status);
				return;
			case "group/add":
				this.addGroup(event.group);
				return;
			case "member/add":
				this.addMember(event.groupId, event.agentId);
				return;
			case "edge/add":
				this.addEdge(event.edge);
				return;
			default: throw new Error(`graph: unknown event kind "${event.kind}"`);
		}
	}
	addAgent(agent, root) {
		if (typeof agent.id !== "string" || agent.id.length === 0) throw new Error("graph: agent id must be a non-empty string");
		if (typeof agent.name !== "string" || agent.name.length === 0) throw new Error(`graph: agent "${agent.id}" name must be non-empty`);
		if (![
			"idle",
			"running",
			"waiting",
			"done",
			"failed"
		].includes(agent.status)) throw new Error(`graph: invalid status "${String(agent.status)}"`);
		if (this.value.agents.some((item) => item.id === agent.id)) throw new Error(`graph: agent "${agent.id}" already exists`);
		if (agent.memberOf !== void 0 || agent.routerFor !== void 0) throw new Error("graph: agent relationships must use group events");
		this.value = {
			...this.value,
			agents: [...this.value.agents, copy(agent)],
			roots: root ? [...this.value.roots, agent.id] : this.value.roots
		};
	}
	status(id, status) {
		if (this.agent(id).status === status) throw new Error(`graph: agent "${id}" already has status "${status}"`);
		this.value = {
			...this.value,
			agents: this.value.agents.map((item) => item.id === id ? {
				...item,
				status
			} : item)
		};
	}
	addGroup(group) {
		if (typeof group.id !== "string" || group.id.length === 0) throw new Error("graph: group id must be a non-empty string");
		if (typeof group.transcriptId !== "string" || group.transcriptId.length === 0) throw new Error(`graph: group "${group.id}" transcript id must be non-empty`);
		if (!Array.isArray(group.memberIds)) throw new Error(`graph: group "${group.id}" member ids must be an array`);
		if (this.value.groups.some((item) => item.id === group.id)) throw new Error(`graph: group "${group.id}" already exists`);
		if (this.agent(group.routerId).routerFor !== void 0) throw new Error(`graph: router "${group.routerId}" already leads a group`);
		if (group.memberIds.length !== 1 || group.memberIds[0] !== group.routerId) throw new Error("graph: a new group must contain exactly its router");
		if (this.value.groups.some((item) => item.transcriptId === group.transcriptId)) throw new Error(`graph: transcript "${group.transcriptId}" already exists`);
		this.value = {
			...this.value,
			groups: [...this.value.groups, copy(group)],
			agents: this.value.agents.map((item) => item.id === group.routerId ? {
				...item,
				routerFor: group.id
			} : item)
		};
	}
	addMember(groupId, id) {
		if (typeof groupId !== "string" || groupId.length === 0) throw new Error("graph: group id must be a non-empty string");
		if (typeof id !== "string" || id.length === 0) throw new Error("graph: agent id must be a non-empty string");
		const group = this.group(groupId);
		const agent = this.agent(id);
		if (group.memberIds.includes(id)) throw new Error(`graph: agent "${id}" is already in group "${groupId}"`);
		if (agent.memberOf !== void 0) throw new Error(`graph: agent "${id}" already belongs to group "${agent.memberOf}"`);
		this.value = {
			...this.value,
			groups: this.value.groups.map((item) => item.id === groupId ? {
				...item,
				memberIds: [...item.memberIds, id]
			} : item),
			agents: this.value.agents.map((item) => item.id === id ? {
				...item,
				memberOf: groupId
			} : item)
		};
	}
	addEdge(edge) {
		if (typeof edge.id !== "string" || edge.id.length === 0) throw new Error("graph: edge id must be a non-empty string");
		if (edge.kind !== "spawn" && edge.kind !== "handoff") throw new Error(`graph: invalid edge kind "${String(edge.kind)}"`);
		if (this.value.edges.some((item) => item.id === edge.id)) throw new Error(`graph: edge "${edge.id}" already exists`);
		this.agent(edge.from);
		this.agent(edge.to);
		if (edge.from === edge.to || this.reaches(edge.to, edge.from)) throw new Error(`graph: edge "${edge.id}" creates a cycle`);
		this.value = {
			...this.value,
			edges: [...this.value.edges, copy(edge)]
		};
	}
	reaches(start, target) {
		const seen = /* @__PURE__ */ new Set();
		const pending = [start];
		while (pending.length > 0) {
			const current = pending.pop();
			if (current === target) return true;
			if (seen.has(current)) continue;
			seen.add(current);
			for (const edge of this.value.edges) if (edge.from === current) pending.push(edge.to);
		}
		return false;
	}
	agent(id) {
		const agent = this.value.agents.find((item) => item.id === id);
		if (agent === void 0) throw new Error(`graph: unknown agent "${id}"`);
		return agent;
	}
	group(id) {
		const group = this.value.groups.find((item) => item.id === id);
		if (group === void 0) throw new Error(`graph: unknown group "${id}"`);
		return group;
	}
};

//#endregion
//#region src/index.ts
function assertStoreId(id) {
	if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`graph: invalid store id "${id}"`);
}
var GraphService = class extends Service {
	static inject = ["sessionPersistence"];
	stores = /* @__PURE__ */ new Map();
	activeId;
	closing = false;
	constructor(ctx, config = {}) {
		super(ctx, "graph");
		const idle = config.storeId ?? "graph-idle";
		this.load(idle);
		ctx.effect(() => () => this.close(), "graph:persistence");
	}
	async switchStore(id) {
		const store = await this.store(id);
		this.activeId = store.id;
		const snapshot = store.state.snapshot();
		this.ctx.emit("graph/change", snapshot);
		return snapshot;
	}
	clearActive() {
		if (this.closing) throw new Error("graph: service is closing");
		this.activeId = void 0;
	}
	async snapshot() {
		return (await this.active()).state.snapshot();
	}
	async snapshotIn(id) {
		return (await this.store(id)).state.snapshot();
	}
	async addAgent(agent, root = false) {
		await this.addAgentIn(this.activeStoreId(), agent, root);
	}
	async addAgentIn(storeId, agent, root = false) {
		await this.commitIn(storeId, [{
			kind: "agent/add",
			agent,
			...root ? { root: true } : {}
		}]);
	}
	async setStatus(agentId, status) {
		await this.setStatusIn(this.activeStoreId(), agentId, status);
	}
	async setStatusIn(storeId, agentId, status) {
		await this.commitIn(storeId, [{
			kind: "agent/status",
			agentId,
			status
		}]);
	}
	async addGroup(group) {
		await this.addGroupIn(this.activeStoreId(), group);
	}
	async addGroupIn(storeId, group) {
		await this.commitIn(storeId, [{
			kind: "group/add",
			group
		}]);
	}
	async addMember(groupId, agentId) {
		await this.addMemberIn(this.activeStoreId(), groupId, agentId);
	}
	async addMemberIn(storeId, groupId, agentId) {
		await this.commitIn(storeId, [{
			kind: "member/add",
			groupId,
			agentId
		}]);
	}
	async addEdge(edge) {
		await this.addEdgeIn(this.activeStoreId(), edge);
	}
	async addEdgeIn(storeId, edge) {
		await this.commitIn(storeId, [{
			kind: "edge/add",
			edge
		}]);
	}
	async commit(events) {
		await this.commitIn(this.activeStoreId(), events);
	}
	async commitIn(storeId, events) {
		if (events.length === 0) throw new Error("graph: cannot commit an empty event batch");
		const store = this.load(storeId);
		const run = store.writes.then(async () => {
			await store.ready;
			const next = store.state.clone();
			for (const event of events) next.apply(event);
			const records = events.map((event, index) => ({
				type: "graph/event",
				seq: SessionSeq(store.nextSeq + index),
				time: Date.now(),
				data: event,
				ignorable: true
			}));
			await store.handle.append(records);
			store.state = next;
			store.nextSeq += records.length;
			this.ctx.emit("graph/change", store.state.snapshot());
		});
		store.writes = run.then(() => void 0, () => void 0);
		await run;
	}
	async active() {
		return this.store(this.activeStoreId());
	}
	activeStoreId() {
		if (this.activeId === void 0) throw new Error("graph: no graph selected");
		return this.activeId;
	}
	async store(id) {
		const store = this.load(id);
		await store.ready;
		return store;
	}
	load(id) {
		if (this.closing) throw new Error("graph: service is closing");
		assertStoreId(id);
		const existing = this.stores.get(id);
		if (existing !== void 0) return existing;
		const store = {
			id,
			sessionId: SessionId(id),
			state: new GraphState(id),
			nextSeq: 0,
			ready: Promise.resolve(),
			writes: Promise.resolve()
		};
		store.ready = this.open(store);
		this.stores.set(id, store);
		return store;
	}
	async open(store) {
		try {
			const listed = (await this.ctx.sessionPersistence.list()).filter((item) => item.header.id === store.sessionId);
			if (listed.length > 1) throw new Error(`graph: duplicate store session "${store.id}"`);
			store.handle = listed.length === 0 ? await this.ctx.sessionPersistence.create(this.header(store.sessionId)) : await this.ctx.sessionPersistence.open(store.sessionId, "write");
			const { events } = await store.handle.read();
			for (const event of events) {
				if (event.type !== "graph/event" || event.ignorable !== true) throw new Error(`graph: invalid persisted event at seq ${event.seq}`);
				const next = store.state.clone();
				next.apply(event.data);
				store.state = next;
				store.nextSeq = event.seq + 1;
			}
			await store.handle.flush();
		} catch (error) {
			await store.handle?.close();
			throw error;
		}
	}
	async close() {
		this.closing = true;
		const results = await Promise.allSettled([...this.stores.values()].map(async (store) => {
			await store.ready;
			await store.writes;
			await store.handle?.close();
		}));
		this.stores.clear();
		for (const result of results) if (result.status === "rejected") throw result.reason;
	}
	header(storeId) {
		return {
			version: SESSION_FORMAT_VERSION,
			id: storeId,
			createdAt: Date.now(),
			isSeeded: false
		};
	}
};
var src_default = GraphService;

//#endregion
export { GraphService, GraphState, src_default as default };