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
var LayoutService = class extends Service {
	static inject = ["sessionPersistence"];
	ready;
	storeId;
	handle;
	state;
	nextSeq = 0;
	writes = Promise.resolve();
	active = false;
	constructor(ctx, config = {}) {
		super(ctx, "layout");
		const rawId = config.storeId ?? "layout-idle";
		if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`layout: invalid store id "${rawId}"`);
		this.storeId = SessionId(rawId);
		this.state = new LayoutState(rawId);
		this.ready = this.open(ctx, this.storeId);
		ctx.effect(() => () => this.ready.then(() => this.handle?.close()), "layout:persistence");
	}
	async switchStore(rawId) {
		if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`layout: invalid store id "${rawId}"`);
		const nextId = SessionId(rawId);
		if (this.active && nextId === this.storeId) return this.state.snapshot();
		const run = this.writes.then(async () => {
			await this.ready;
			await this.handle?.flush();
			this.handle?.close();
			this.handle = void 0;
			this.storeId = nextId;
			this.state = new LayoutState(rawId);
			this.nextSeq = 0;
			this.ready = this.open(this.ctx, nextId);
			await this.ready;
			this.active = true;
			const snap = this.state.snapshot();
			this.ctx.emit("layout/change", snap);
			return snap;
		});
		this.writes = run.then(() => void 0);
		return run;
	}
	async snapshot() {
		await this.ready;
		if (!this.active) throw new Error("layout: no graph selected");
		return this.state.snapshot();
	}
	async set(sessionId, node) {
		await this.commit([{
			kind: "node/set",
			sessionId,
			node
		}]);
	}
	async remove(sessionId) {
		await this.commit([{
			kind: "node/remove",
			sessionId
		}]);
	}
	async commit(events) {
		if (events.length === 0) throw new Error("layout: cannot commit an empty event batch");
		if (!this.active) throw new Error("layout: no graph selected");
		const run = this.writes.then(async () => {
			await this.ready;
			const next = this.state.clone();
			for (const event of events) next.apply(event);
			const records = events.map((event, index) => ({
				type: "layout/event",
				seq: SessionSeq(this.nextSeq + index),
				time: Date.now(),
				data: event,
				ignorable: true
			}));
			await this.handle.append(records);
			this.state = next;
			this.nextSeq += records.length;
			this.ctx.emit("layout/change", this.state.snapshot());
		});
		this.writes = run;
		return run;
	}
	async open(ctx, storeId) {
		const listed = (await ctx.sessionPersistence.list()).filter((item) => item.header.id === storeId);
		if (listed.length > 1) throw new Error(`layout: duplicate store session "${storeId}"`);
		this.handle = listed.length === 0 ? await ctx.sessionPersistence.create(this.header(storeId)) : await ctx.sessionPersistence.open(storeId, "write");
		const { events } = await this.handle.read();
		for (const event of events) {
			if (event.type !== "layout/event" || event.ignorable !== true) throw new Error(`layout: invalid persisted event at seq ${event.seq}`);
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
var src_default = LayoutService;

//#endregion
export { DEFAULT_ROOT, LayoutService, LayoutState, src_default as default };