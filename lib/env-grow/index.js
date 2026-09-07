import { Context, Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";
import { randomUUID } from "node:crypto";

//#region src/env-grow/index.ts
var EnvGrowService = class extends Service {
	static inject = [
		"graph",
		"agentRuntime",
		"agents",
		"envBuilder"
	];
	constructor(ctx) {
		super(ctx, "envGrow");
		const store = ctx.get("envBuilder").store;
		const addComponent = store.addComponent.bind(store);
		store.addComponent = async (envId, ref) => {
			const dir = await addComponent(envId, ref);
			await this.grow(envId, dir);
			return dir;
		};
		ctx.effect(() => () => {
			store.addComponent = addComponent;
		}, "env-grow: add component");
	}
	async grow(envId, dir) {
		const store = this.ctx.get("envBuilder").store;
		const component = store.get(envId).components.find((item) => item.dir === dir.split("/").pop());
		if (component === void 0) throw new Error(`env-grow: installed component is missing from ${envId}`);
		const snapshot = await this.ctx.graph.snapshot();
		if (snapshot.roots.length !== 1) throw new Error("env-grow: expected one singularity root, got " + snapshot.roots.length);
		const rootId = snapshot.roots[0];
		if (rootId === void 0) throw new Error("env-grow: singularity root is missing");
		const rootNode = snapshot.agents.find((agent) => agent.id === rootId);
		if (rootNode === void 0) throw new Error(`env-grow: root agent "${rootId}" is missing from graph`);
		if (rootNode.node === void 0) throw new Error(`env-grow: root agent "${rootId}" has no canvas node`);
		const root = this.ctx.agents.get(rootId);
		if (root === void 0) throw new Error(`env-grow: root agent "${rootId}" is not live`);
		const childIndex = snapshot.agents.filter((agent) => agent.id !== rootId).length;
		const node = radialNode(rootNode.node, childIndex);
		const sessionId = SessionId(`component-${randomUUID()}`);
		const handle = await this.ctx.agentRuntime.spawn(root, {
			sessionId,
			name: `${component.owner}/${component.repo}`,
			prompt: [{
				type: "text",
				text: `Inspect the newly installed ${component.owner}/${component.repo} component.`
			}],
			node
		});
		try {
			store.attachSession(envId, handle.agent.id);
		} catch (error) {
			await handle.dispose();
			throw error;
		}
	}
};
function radialNode(root, index) {
	const width = 168;
	const height = 76;
	const radius = 240;
	const angle = -Math.PI / 2 + index * Math.PI / 3;
	const centerX = root.x + root.width / 2 + Math.cos(angle) * radius;
	const centerY = root.y + root.height / 2 + Math.sin(angle) * radius;
	return {
		x: Math.round(centerX - width / 2),
		y: Math.round(centerY - height / 2),
		width,
		height,
		shape: "card"
	};
}
var env_grow_default = EnvGrowService;

//#endregion
export { EnvGrowService, env_grow_default as default };