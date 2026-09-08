import { Context, Service } from "@deepseek-ai/cordis";
import { cwd } from "node:process";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";

//#region src/agent/index.ts
const ROOT_NODE = {
	x: 80,
	y: 80,
	width: 168,
	height: 76,
	shape: "card"
};
var AgentRuntime = class extends Service {
	static inject = [
		"agentDefaultModel",
		"agents",
		"graph",
		"sessions",
		"sessionPersistence"
	];
	owned = /* @__PURE__ */ new Set();
	handles = /* @__PURE__ */ new Map();
	transcripts = /* @__PURE__ */ new Map();
	constructor(ctx) {
		super(ctx, "agentRuntime");
		ctx.provide("sessionVisibility", { isVisible: (sessionId) => !this.owned.has(sessionId) });
		ctx.on("agent/status", ({ agent, status }) => {
			if (this.owned.has(agent.id)) ctx.graph.setStatus(agent.id, status);
		});
		ctx.on("session/event", (session, event) => {
			const transcript = this.transcripts.get(session.id);
			if (transcript === void 0) return;
			if (event.type === "assistant/message") transcript.append("user/message", {
				...event.data.message,
				role: "user",
				source: {
					kind: "group",
					agentId: session.id
				}
			}, { surfaceOp: "append" });
			if (event.type === "user/message" && event.data.source.kind === "relay") transcript.append("user/message", {
				...event.data,
				source: {
					kind: "group",
					agentId: event.data.source.from
				}
			}, { surfaceOp: "append" });
		});
		ctx.effect(() => async () => {
			await Promise.all([...this.handles.values()].map((handle) => handle.dispose()));
			for (const agent of ctx.agents.list()) if (this.owned.has(agent.id)) agent.cancel({ kind: "disposed" });
			this.handles.clear();
			this.owned.clear();
		}, "agentRuntime: dispose");
		ctx.effect(async () => {
			const snapshot = await ctx.graph.snapshot();
			try {
				if (snapshot.roots.length === 0) await this.createRoot({
					sessionId: SessionId("root"),
					node: ROOT_NODE
				});
				else {
					for (const sessionId of snapshot.roots) if (snapshot.agents.find((item) => item.id === sessionId)?.node === void 0) await ctx.graph.setNode(sessionId, ROOT_NODE);
					for (const sessionId of snapshot.roots) {
						if (ctx.agents.get(sessionId) !== void 0) throw new Error(`agent-runtime: root agent "${sessionId}" is already live`);
						this.owned.add(sessionId);
						try {
							const handle = await ctx.agents.resume({
								resumeSessionId: sessionId,
								agentOptions: this.ctx.agentDefaultModel.currentSelection()
							});
							this.handles.set(sessionId, handle);
						} catch (error) {
							this.owned.delete(sessionId);
							throw error;
						}
					}
				}
			} catch (error) {
				await Promise.all([...this.handles.values()].map((handle) => handle.dispose()));
				this.handles.clear();
				this.owned.clear();
				throw error;
			}
			return () => {};
		}, "agentRuntime: roots");
	}
	async createRoot(request) {
		this.owned.add(request.sessionId);
		let handle;
		try {
			handle = await this.ctx.agents.create({
				sessionId: request.sessionId,
				meta: { cwd: cwd() },
				agentOptions: {
					...this.ctx.agentDefaultModel.currentSelection(),
					...request.agentOptions
				}
			});
		} catch (error) {
			this.owned.delete(request.sessionId);
			throw error;
		}
		try {
			await this.ctx.graph.addAgent({
				id: handle.agent.id,
				name: "Singularity",
				status: "idle",
				node: request.node
			}, true);
			this.handles.set(handle.agent.id, handle);
			return handle;
		} catch (error) {
			this.owned.delete(request.sessionId);
			this.owned.delete(handle.agent.id);
			await handle.dispose();
			throw error;
		}
	}
	async spawn(parent, request) {
		this.live(parent);
		this.owned.add(request.sessionId);
		let handle;
		try {
			handle = await parent.ctx.agents.create({
				sessionId: request.sessionId,
				meta: {
					parentSession: parent.id,
					origin: "subagent"
				},
				agentOptions: {
					...this.ctx.agentDefaultModel.currentSelection(),
					...request.agentOptions
				},
				signal: request.signal
			});
		} catch (error) {
			this.owned.delete(request.sessionId);
			throw error;
		}
		try {
			const events = [{
				kind: "agent/add",
				agent: {
					id: handle.agent.id,
					name: request.name,
					status: "idle",
					node: request.node
				}
			}, {
				kind: "edge/add",
				edge: {
					id: `${parent.id}->${handle.agent.id}`,
					kind: "spawn",
					from: parent.id,
					to: handle.agent.id
				}
			}];
			await this.ctx.graph.commit(events);
			this.owned.add(handle.agent.id);
			this.handles.set(handle.agent.id, handle);
			handle.agent.followup(createUserMessage({
				content: [...request.prompt],
				source: { kind: "user" }
			}));
			return handle;
		} catch (error) {
			this.owned.delete(request.sessionId);
			this.owned.delete(handle.agent.id);
			await handle.dispose();
			throw error;
		}
	}
	async destroySession(sessionId) {
		const id = SessionId(sessionId);
		const handle = this.handles.get(id) ?? await this.ctx.agents.resume({
			resumeSessionId: id,
			agentOptions: this.ctx.agentDefaultModel.currentSelection()
		});
		this.handles.delete(id);
		this.owned.delete(id);
		await handle.dispose();
	}
	async createGroup(router, request) {
		this.live(router);
		const transcript = router.ctx.sessions.prepare(request.transcriptId);
		const detach = router.ctx.sessions.enter(transcript);
		let stored;
		const group = {
			id: request.id,
			routerId: router.id,
			transcriptId: request.transcriptId,
			memberIds: [router.id]
		};
		try {
			stored = await this.ctx.sessionPersistence.create(transcript.header);
			router.ctx.sessions.announce(transcript);
			await this.ctx.graph.addGroup(group);
			this.transcripts.set(router.id, transcript);
			const handle = stored;
			router.ctx.effect(() => async () => {
				for (const [agentId, value] of this.transcripts) if (value === transcript) this.transcripts.delete(agentId);
				await handle.close();
				detach();
			}, `agent-runtime: group ${request.id}`);
			return {
				group,
				transcript
			};
		} catch (error) {
			await stored?.close();
			detach();
			throw error;
		}
	}
	async addMember(groupId, member) {
		this.live(member);
		const group = (await this.ctx.graph.snapshot()).groups.find((item) => item.id === groupId);
		if (group === void 0) throw new Error(`agent-runtime: group "${groupId}" is not in graph`);
		const transcript = this.ctx.sessions.get(group.transcriptId);
		if (transcript === void 0) throw new Error(`agent-runtime: group transcript "${group.transcriptId}" is not live`);
		await this.ctx.graph.addMember(groupId, member.id);
		this.transcripts.set(member.id, transcript);
	}
	async handoff(parent, child, brief) {
		this.live(parent);
		this.live(child);
		await this.ctx.graph.addEdge({
			id: `${parent.id}->${child.id}:handoff`,
			kind: "handoff",
			from: parent.id,
			to: child.id,
			...brief === void 0 ? {} : { brief }
		});
	}
	async relay(request) {
		this.live(request.from);
		this.live(request.to);
		const snapshot = await this.ctx.graph.snapshot();
		const from = snapshot.agents.find((agent) => agent.id === request.from.id);
		const to = snapshot.agents.find((agent) => agent.id === request.to.id);
		if (from === void 0 || to === void 0) throw new Error("agent-runtime: relay endpoint is not in graph");
		if (to.memberOf !== void 0 && to.routerFor === void 0) {
			const targetGroup = snapshot.groups.find((group) => group.id === to.memberOf);
			const sameGroup = from.memberOf === to.memberOf;
			const targetRouter = targetGroup?.routerId === from.id;
			if (!sameGroup && !targetRouter) throw new Error(`agent-runtime: agent "${to.id}" is hidden behind group "${to.memberOf}"`);
		}
		request.to.followup(createUserMessage({
			content: [...request.prompt],
			source: {
				kind: "relay",
				from: request.from.id,
				to: request.to.id
			}
		}));
	}
	async prompt(router, prompt) {
		this.live(router);
		const snapshot = await this.ctx.graph.snapshot();
		const node = snapshot.agents.find((agent) => agent.id === router.id);
		if (node === void 0) throw new Error(`agent-runtime: agent "${router.id}" is not in graph`);
		const message = createUserMessage({
			content: [...prompt],
			source: { kind: "user" }
		});
		if (node.routerFor === void 0) {
			if (!snapshot.roots.includes(router.id)) throw new Error(`agent-runtime: agent "${router.id}" is not a router`);
			router.followup(message);
			return;
		}
		const group = snapshot.groups.find((item) => item.id === node.routerFor);
		if (group === void 0) throw new Error(`agent-runtime: router group "${node.routerFor}" is not in graph`);
		const transcript = this.ctx.sessions.get(group.transcriptId);
		if (transcript === void 0) throw new Error(`agent-runtime: group transcript "${group.transcriptId}" is not live`);
		transcript.append("user/message", message, { surfaceOp: "append" });
		router.followup(message);
	}
	live(agent) {
		if (this.ctx.agents.get(agent.id) !== agent) throw new Error(`agent-runtime: agent "${agent.id}" is not live`);
	}
};
var agent_default = AgentRuntime;

//#endregion
export { AgentRuntime, agent_default as default };