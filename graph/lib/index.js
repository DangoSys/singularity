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
var GraphService = class extends Service {
	static inject = ["sessionPersistence"];
	ready;
	storeId;
	handle;
	state;
	nextSeq = 0;
	writes = Promise.resolve();
	active = false;
	constructor(ctx, config = {}) {
		super(ctx, "graph");
		const rawId = config.storeId ?? "graph-idle";
		if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`graph: invalid store id "${rawId}"`);
		this.storeId = SessionId(rawId);
		this.state = new GraphState(rawId);
		this.ready = this.open(ctx, this.storeId);
		ctx.effect(() => () => this.ready.then(() => this.handle?.close()), "graph:persistence");
	}
	async switchStore(rawId) {
		if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`graph: invalid store id "${rawId}"`);
		const nextId = SessionId(rawId);
		if (this.active && nextId === this.storeId) return this.state.snapshot();
		const run = this.writes.then(async () => {
			await this.ready;
			await this.handle?.flush();
			this.handle?.close();
			this.handle = void 0;
			this.storeId = nextId;
			this.state = new GraphState(rawId);
			this.nextSeq = 0;
			this.ready = this.open(this.ctx, nextId);
			await this.ready;
			this.active = true;
			const snap = this.state.snapshot();
			this.ctx.emit("graph/change", snap);
			return snap;
		});
		this.writes = run.then(() => void 0);
		return run;
	}
	async snapshot() {
		await this.ready;
		if (!this.active) throw new Error("graph: no graph selected");
		return this.state.snapshot();
	}
	async addAgent(agent, root = false) {
		await this.commit([{
			kind: "agent/add",
			agent,
			...root ? { root: true } : {}
		}]);
	}
	async setStatus(agentId, status) {
		await this.commit([{
			kind: "agent/status",
			agentId,
			status
		}]);
	}
	async addGroup(group) {
		await this.commit([{
			kind: "group/add",
			group
		}]);
	}
	async addMember(groupId, agentId) {
		await this.commit([{
			kind: "member/add",
			groupId,
			agentId
		}]);
	}
	async addEdge(edge) {
		await this.commit([{
			kind: "edge/add",
			edge
		}]);
	}
	async commit(events) {
		if (events.length === 0) throw new Error("graph: cannot commit an empty event batch");
		if (!this.active) throw new Error("graph: no graph selected");
		const run = this.writes.then(async () => {
			await this.ready;
			const next = this.state.clone();
			for (const event of events) next.apply(event);
			const records = events.map((event, index) => ({
				type: "graph/event",
				seq: SessionSeq(this.nextSeq + index),
				time: Date.now(),
				data: event,
				ignorable: true
			}));
			await this.handle.append(records);
			this.state = next;
			this.nextSeq += records.length;
			this.ctx.emit("graph/change", this.state.snapshot());
		});
		this.writes = run;
		return run;
	}
	async open(ctx, storeId) {
		const listed = (await ctx.sessionPersistence.list()).filter((item) => item.header.id === storeId);
		if (listed.length > 1) throw new Error(`graph: duplicate store session "${storeId}"`);
		this.handle = listed.length === 0 ? await ctx.sessionPersistence.create(this.header(storeId)) : await ctx.sessionPersistence.open(storeId, "write");
		const { events } = await this.handle.read();
		for (const event of events) {
			if (event.type !== "graph/event" || event.ignorable !== true) throw new Error(`graph: invalid persisted event at seq ${event.seq}`);
			const stored = event;
			const next = this.state.clone();
			next.apply(stored.data);
			this.state = next;
			this.nextSeq = event.seq + 1;
		}
		await this.handle.flush();
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