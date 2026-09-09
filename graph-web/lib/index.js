import { createRequire } from "node:module";
import { Context } from "@deepseek-ai/cordis";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";

//#region src/constants.ts
const GRAPH_PATH = "/singularity/graph";
const LAYOUT_PATH = "/singularity/layout";
const EVENTS_PATH = "/singularity/events";
const TRANSCRIPT_PATH = "/singularity/transcript";
const NOTICES_PATH = "/singularity/notices";
const MAP_PATH = "/singularity/map";
const GRAPHS_PATH = "/singularity/graphs";
const GRAPH_ENVS_PATH = "/singularity/graph-envs";
const REPO_CHECK_PATH = "/singularity/repo-check";
const HITL_PATH = "/singularity/hitl";

//#endregion
//#region src/web/libs/http.ts
const MAX_BODY = 64 * 1024;
function send(res, status, type, value) {
	res.writeHead(status, {
		"content-type": type,
		"cache-control": "no-store"
	});
	res.end(typeof value === "string" ? value : JSON.stringify(value));
}
async function readJson(req, limit = MAX_BODY) {
	const chunks = [];
	let length = 0;
	for await (const chunk of req) {
		const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		length += buf.length;
		if (length > limit) throw new Error("request body too large");
		chunks.push(buf);
	}
	const raw = Buffer.concat(chunks).toString("utf8");
	if (raw.length === 0) throw new Error("empty request body");
	return JSON.parse(raw);
}

//#endregion
//#region src/web/api/events.ts
function registerEvents(ctx, broadcast) {
	return ctx.webServer.register({
		kind: "exact",
		path: EVENTS_PATH,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			res.writeHead(200, {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive"
			});
			broadcast.clients.add(res);
			req.on("close", () => broadcast.clients.delete(res));
			try {
				res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`);
				res.write(`event: layout\ndata: ${JSON.stringify(await ctx.layout.snapshot())}\n\n`);
			} catch (error) {
				res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`);
			}
			try {
				res.write(`event: graphs\ndata: ${JSON.stringify(await ctx.graphs.snapshot())}\n\n`);
			} catch (error) {
				res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`);
			}
			try {
				res.write(`event: hitl\ndata: ${JSON.stringify({ pending: ctx.hitl.list() })}\n\n`);
			} catch (error) {
				res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`);
			}
		}
	});
}

//#endregion
//#region src/web/api/graph.ts
function registerGraph(ctx) {
	return ctx.webServer.register({
		kind: "exact",
		path: GRAPH_PATH,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			try {
				send(res, 200, "application/json; charset=utf-8", await ctx.graph.snapshot());
			} catch (error) {
				send(res, 409, "text/plain; charset=utf-8", error instanceof Error ? error.message : String(error));
			}
		}
	});
}

//#endregion
//#region src/web/api/graph-envs.ts
function registerGraphEnvs(ctx) {
	const stopList = ctx.webServer.register({
		kind: "exact",
		path: GRAPH_ENVS_PATH,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			const bound = new Set((await ctx.graphs.list()).map((g) => g.envId));
			send(res, 200, "application/json; charset=utf-8", { envs: ctx.envBuilder.store.list().map((env) => ({
				id: env.id,
				path: env.path,
				componentCount: env.components.length,
				sessionCount: env.sessionIds.length,
				available: !bound.has(env.id) && env.sessionIds.length === 0,
				bound: bound.has(env.id)
			})) });
		}
	});
	const stopCheck = ctx.webServer.register({
		kind: "exact",
		path: REPO_CHECK_PATH,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			const body = await readJson(req);
			if (typeof body.repo !== "string" || body.repo.trim().length === 0) throw new Error("repo-check: missing repo");
			const parsed = await ctx.envBuilder.assertRepo(body.repo);
			send(res, 200, "application/json; charset=utf-8", {
				owner: parsed.owner,
				repo: parsed.repo,
				ref: parsed.dir
			});
		}
	});
	return () => {
		stopList();
		stopCheck();
	};
}

//#endregion
//#region src/web/api/graphs.ts
function fail(res, error) {
	send(res, 400, "text/plain; charset=utf-8", error instanceof Error ? error.message : String(error));
}
function registerGraphs(ctx) {
	const stopList = ctx.webServer.register({
		kind: "exact",
		path: GRAPHS_PATH,
		handler: async (req, res) => {
			try {
				if (req.method === "GET") {
					send(res, 200, "application/json; charset=utf-8", await ctx.graphs.snapshot());
					return;
				}
				if (req.method === "POST") {
					const body = await readJson(req);
					send(res, 200, "application/json; charset=utf-8", await ctx.graphs.create(body));
					return;
				}
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
			} catch (error) {
				fail(res, error);
			}
		}
	});
	const stopActions = ctx.webServer.register({
		kind: "prefix",
		path: GRAPHS_PATH,
		handler: async (req, res) => {
			try {
				const url = new URL(req.url ?? "/", "http://dsh.local");
				const parts = url.pathname.slice(GRAPHS_PATH.length + 1).split("/").filter(Boolean);
				if (parts.length !== 2) throw new Error(`graphs: unknown path ${url.pathname}`);
				const [id, action] = parts;
				if (id.length === 0) throw new Error("graphs: missing graph id");
				if (action === "select") {
					if (req.method !== "POST") {
						send(res, 405, "text/plain; charset=utf-8", "method not allowed");
						return;
					}
					send(res, 200, "application/json; charset=utf-8", await ctx.graphs.select(id));
					return;
				}
				if (action === "ready") {
					if (req.method !== "POST") {
						send(res, 405, "text/plain; charset=utf-8", "method not allowed");
						return;
					}
					send(res, 200, "application/json; charset=utf-8", await ctx.graphs.markReady(id));
					return;
				}
				if (action === "delete") {
					if (req.method !== "POST") {
						send(res, 405, "text/plain; charset=utf-8", "method not allowed");
						return;
					}
					await ctx.graphs.remove(id);
					send(res, 200, "application/json; charset=utf-8", { ok: true });
					return;
				}
				throw new Error(`graphs: unknown action ${action}`);
			} catch (error) {
				fail(res, error);
			}
		}
	});
	return () => {
		stopList();
		stopActions();
	};
}

//#endregion
//#region src/web/api/hitl.ts
function registerHitl(ctx) {
	return ctx.webServer.register({
		kind: "exact",
		path: HITL_PATH,
		handler: async (req, res) => {
			if (req.method === "GET") {
				send(res, 200, "application/json; charset=utf-8", { pending: ctx.hitl.list() });
				return;
			}
			if (req.method === "POST") {
				const body = await readJson(req);
				if (typeof body.id !== "string" || body.id.length === 0) throw new Error("hitl: missing id");
				if (body.answer === void 0) throw new Error("hitl: missing answer");
				ctx.hitl.answer(body.id, body.answer);
				send(res, 200, "application/json; charset=utf-8", {
					ok: true,
					pending: ctx.hitl.list()
				});
				return;
			}
			send(res, 405, "text/plain; charset=utf-8", "method not allowed");
		}
	});
}

//#endregion
//#region src/web/api/layout.ts
function registerLayout(ctx) {
	return ctx.webServer.register({
		kind: "exact",
		path: LAYOUT_PATH,
		handler: async (req, res) => {
			try {
				if (req.method === "GET") {
					send(res, 200, "application/json; charset=utf-8", await ctx.layout.snapshot());
					return;
				}
				if (req.method !== "PUT") {
					send(res, 405, "text/plain; charset=utf-8", "method not allowed");
					return;
				}
				const body = await readJson(req);
				if (typeof body.sessionId !== "string" || body.sessionId.length === 0) throw new Error("layout put: sessionId required");
				if (body.node === void 0 || typeof body.node !== "object") throw new Error("layout put: node required");
				await ctx.layout.set(body.sessionId, body.node);
				send(res, 200, "application/json; charset=utf-8", await ctx.layout.snapshot());
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				send(res, message.includes("no graph selected") ? 409 : 400, "text/plain; charset=utf-8", message);
			}
		}
	});
}

//#endregion
//#region src/web/api/map-static.ts
const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
	".json": "application/json; charset=utf-8"
};
const require = createRequire(import.meta.url);
function appDir() {
	return resolve(require.resolve("@dangosys/dsh-singularity-map/package.json"), "..", "dist");
}
function assetPath(root, rel) {
	const abs = resolve(root, normalize(rel));
	if (abs !== root && !abs.startsWith(root + sep)) throw new Error(`map static: path escape "${rel}"`);
	return abs;
}
function registerMapStatic(ctx) {
	const root = appDir();
	const prefix = MAP_PATH;
	const serve = async (req, res) => {
		let rel = new URL(req.url ?? "/", "http://dsh.local").pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
		if (rel.endsWith("/")) rel += "index.html";
		const abs = assetPath(root, rel);
		const body = await readFile(abs);
		const type = MIME[extname(abs).toLowerCase()];
		if (type === void 0) throw new Error(`map static: unknown mime for ${abs}`);
		res.writeHead(200, {
			"content-type": type,
			"cache-control": "no-store"
		});
		res.end(body);
	};
	const stopRedirect = ctx.webServer.register({
		kind: "exact",
		path: prefix,
		handler: (_req, res) => {
			res.writeHead(302, { location: prefix + "/" });
			res.end();
		}
	});
	const stopStatic = ctx.webServer.register({
		kind: "prefix",
		path: prefix,
		handler: serve
	});
	return () => {
		stopRedirect();
		stopStatic();
	};
}

//#endregion
//#region src/web/api/notices.ts
function registerNotices(ctx, broadcast) {
	return ctx.webServer.register({
		kind: "exact",
		path: NOTICES_PATH,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			res.writeHead(200, {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive"
			});
			broadcast.notices.add(res);
			req.on("close", () => broadcast.notices.delete(res));
		}
	});
}

//#endregion
//#region src/web/api/transcript.ts
function registerTranscript(ctx) {
	return ctx.webServer.register({
		kind: "exact",
		path: TRANSCRIPT_PATH,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				send(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			try {
				const groupId = new URL(req.url, "http://local").searchParams.get("group");
				if (groupId === null || groupId.length === 0) throw new Error("web: transcript requires group");
				const group = (await ctx.graph.snapshot()).groups.find((item) => item.id === groupId);
				if (group === void 0) throw new Error(`web: group "${groupId}" is not in graph`);
				const session = ctx.sessions.get(group.transcriptId);
				if (session === void 0) throw new Error(`web: transcript "${group.transcriptId}" is not live`);
				send(res, 200, "application/json; charset=utf-8", {
					groupId,
					transcriptId: group.transcriptId,
					events: session.snapshotEvents()
				});
			} catch (error) {
				send(res, 400, "text/plain; charset=utf-8", error instanceof Error ? error.message : String(error));
			}
		}
	});
}

//#endregion
//#region src/web/libs/broadcast.ts
var GraphBroadcast = class {
	clients = /* @__PURE__ */ new Set();
	notices = /* @__PURE__ */ new Set();
	previousStatuses = /* @__PURE__ */ new Map();
	publishEvent(name$1, value) {
		const frame = `event: ${name$1}\ndata: ${JSON.stringify(value)}\n\n`;
		for (const res of this.clients) if (res.destroyed) this.clients.delete(res);
		else res.write(frame);
	}
	publishLayout(snapshot) {
		this.publishEvent("layout", snapshot);
	}
	publish(snapshot) {
		const frame = `event: graph\ndata: ${JSON.stringify(snapshot)}\n\n`;
		for (const res of this.clients) if (res.destroyed) this.clients.delete(res);
		else res.write(frame);
		for (const agent of snapshot.agents) {
			const previous = this.previousStatuses.get(agent.id);
			const text = previous === "running" && agent.status === "idle" ? "已完成当前任务" : agent.status === "done" ? "任务已完成" : agent.status === "failed" ? "任务执行失败" : agent.status === "waiting" ? "正在等待处理" : void 0;
			if (text === void 0 || previous === agent.status) continue;
			const notice = `event: notice\ndata: ${JSON.stringify({
				agentId: agent.id,
				status: agent.status,
				text
			})}\n\n`;
			for (const res of this.notices) if (res.destroyed) this.notices.delete(res);
			else res.write(notice);
		}
		this.previousStatuses = new Map(snapshot.agents.map((agent) => [agent.id, agent.status]));
	}
	close() {
		for (const res of this.clients) res.end();
		this.clients.clear();
		for (const res of this.notices) res.end();
		this.notices.clear();
	}
};

//#endregion
//#region src/index.ts
const name = "graph-web";
const inject = [
	"graph",
	"layout",
	"graphs",
	"envBuilder",
	"sessions",
	"webServer",
	"hitl"
];
function apply(ctx) {
	const broadcast = new GraphBroadcast();
	ctx.on("graph/change", (snapshot) => broadcast.publish(snapshot));
	ctx.on("layout/change", (snapshot) => broadcast.publishLayout(snapshot));
	ctx.on("graphs/change", (snapshot) => broadcast.publishEvent("graphs", snapshot));
	ctx.on("hitl/change", (pending) => broadcast.publishEvent("hitl", { pending }));
	ctx.on("pr-chat/path", (event) => broadcast.publishEvent("pr-chat/path", event));
	ctx.on("pr-chat/sent", (event) => broadcast.publishEvent("pr-chat/sent", event));
	ctx.effect(() => {
		const graph = registerGraph(ctx);
		const layout = registerLayout(ctx);
		const graphs = registerGraphs(ctx);
		const graphEnvs = registerGraphEnvs(ctx);
		const hitl = registerHitl(ctx);
		const events = registerEvents(ctx, broadcast);
		const transcript = registerTranscript(ctx);
		const notices = registerNotices(ctx, broadcast);
		const map = registerMapStatic(ctx);
		return () => {
			graph();
			layout();
			graphs();
			graphEnvs();
			hitl();
			events();
			transcript();
			notices();
			map();
			broadcast.close();
		};
	}, "web: routes");
}

//#endregion
export { apply, inject, name };