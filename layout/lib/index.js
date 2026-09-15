import { Context, Service } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";

//#region src/service/state.ts
function copy(value) {
	return structuredClone(value);
}
function assertNode(node, sessionId) {
	if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error(`layout: session "${sessionId}" position must be finite`);
	if (!Number.isFinite(node.width) || node.width <= 0 || !Number.isFinite(node.height) || node.height <= 0) throw new Error(`layout: session "${sessionId}" size must be positive`);
	if (node.shape !== "card" && node.shape !== "circle" && node.shape !== "diamond") throw new Error(`layout: session "${sessionId}" has invalid shape`);
}
var LayoutState = class LayoutState {
	value;
	constructor(id, snapshot) {
		this.value = snapshot === void 0 ? {
			version: 1,
			id,
			nodes: {}
		} : copy(snapshot);
	}
	clone() {
		return new LayoutState(this.value.id, this.value);
	}
	snapshot() {
		return copy(this.value);
	}
	get(sessionId) {
		const node = this.value.nodes[sessionId];
		if (node === void 0) throw new Error(`layout: unknown session "${sessionId}"`);
		return copy(node);
	}
	apply(event) {
		switch (event.kind) {
			case "node/set":
				assertNode(event.node, event.sessionId);
				this.value = {
					...this.value,
					nodes: {
						...this.value.nodes,
						[event.sessionId]: copy(event.node)
					}
				};
				return;
			case "node/remove": {
				if (this.value.nodes[event.sessionId] === void 0) throw new Error(`layout: unknown session "${event.sessionId}"`);
				const nodes = { ...this.value.nodes };
				delete nodes[event.sessionId];
				this.value = {
					...this.value,
					nodes
				};
				return;
			}
			default: throw new Error(`layout: unknown event kind "${event.kind}"`);
		}
	}
};

//#endregion
//#region src/types.ts
const DEFAULT_ROOT = {
	x: 80,
	y: 80,
	width: 168,
	height: 76,
	shape: "card"
};

//#endregion
//#region src/index.ts
function assertId(id) {
	if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error("layout: invalid store id " + id);
}
var LayoutService = class extends Service {
	static inject = ["sessionPersistence"];
	entries = /* @__PURE__ */ new Map();
	activeId;
	closing = false;
	constructor(ctx, config = {}) {
		super(ctx, "layout");
		this.openEntry(config.storeId ?? "layout-idle");
		ctx.effect(() => () => this.close(), "layout:persistence");
	}
	async switchStore(id) {
		const entry = await this.entry(id);
		this.activeId = id;
		const snap = entry.state.snapshot();
		this.ctx.emit("layout/change", snap);
		return snap;
	}
	clearActive() {
		if (this.closing) throw new Error("layout: service is closing");
		this.activeId = void 0;
	}
	async snapshot() {
		return (await this.active()).state.snapshot();
	}
	async snapshotIn(id) {
		return (await this.entry(id)).state.snapshot();
	}
	async set(sessionId, node) {
		await this.setIn(this.activeIdOf(), sessionId, node);
	}
	async setIn(id, sessionId, node) {
		await this.commitIn(id, [{
			kind: "node/set",
			sessionId,
			node
		}]);
	}
	async remove(sessionId) {
		await this.removeIn(this.activeIdOf(), sessionId);
	}
	async removeIn(id, sessionId) {
		await this.commitIn(id, [{
			kind: "node/remove",
			sessionId
		}]);
	}
	async commit(events) {
		await this.commitIn(this.activeIdOf(), events);
	}
	async commitIn(id, events) {
		if (events.length === 0) throw new Error("layout: cannot commit an empty event batch");
		const entry = this.openEntry(id);
		const run = entry.writes.then(async () => {
			await entry.ready;
			const next = entry.state.clone();
			for (const event of events) next.apply(event);
			const records = events.map((data, index) => ({
				type: "layout/event",
				seq: SessionSeq(entry.nextSeq + index),
				time: Date.now(),
				data,
				ignorable: true
			}));
			await entry.handle.append(records);
			entry.state = next;
			entry.nextSeq += records.length;
			this.ctx.emit("layout/change", entry.state.snapshot());
		});
		entry.writes = run.then(() => void 0, () => void 0);
		await run;
	}
	async active() {
		return this.entry(this.activeIdOf());
	}
	activeIdOf() {
		if (this.activeId === void 0) throw new Error("layout: no graph selected");
		return this.activeId;
	}
	async entry(id) {
		const entry = this.openEntry(id);
		await entry.ready;
		return entry;
	}
	openEntry(id) {
		if (this.closing) throw new Error("layout: service is closing");
		assertId(id);
		const existing = this.entries.get(id);
		if (existing) return existing;
		const entry = {
			id,
			sessionId: SessionId(id),
			state: new LayoutState(id),
			nextSeq: 0,
			ready: Promise.resolve(),
			writes: Promise.resolve()
		};
		entry.ready = this.open(entry);
		this.entries.set(id, entry);
		return entry;
	}
	async open(entry) {
		try {
			const listed = (await this.ctx.sessionPersistence.list()).filter((item) => item.header.id === entry.sessionId);
			if (listed.length > 1) throw new Error("layout: duplicate store session " + entry.id);
			entry.handle = listed.length === 0 ? await this.ctx.sessionPersistence.create(this.header(entry.sessionId)) : await this.ctx.sessionPersistence.open(entry.sessionId, "write");
			const { events } = await entry.handle.read();
			for (const event of events) {
				if (event.type !== "layout/event" || event.ignorable !== true) throw new Error("layout: invalid persisted event");
				const next = entry.state.clone();
				next.apply(event.data);
				entry.state = next;
				entry.nextSeq = event.seq + 1;
			}
			await entry.handle.flush();
		} catch (error) {
			await entry.handle?.close();
			throw error;
		}
	}
	async close() {
		this.closing = true;
		const results = await Promise.allSettled([...this.entries.values()].map(async (entry) => {
			await entry.ready;
			await entry.writes;
			await entry.handle?.close();
		}));
		this.entries.clear();
		for (const result of results) if (result.status === "rejected") throw result.reason;
	}
	header(id) {
		return {
			version: SESSION_FORMAT_VERSION,
			id,
			createdAt: Date.now(),
			isSeeded: false
		};
	}
};
var src_default = LayoutService;

//#endregion
export { DEFAULT_ROOT, LayoutService, LayoutState, src_default as default };