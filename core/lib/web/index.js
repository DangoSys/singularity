import { Context } from "@deepseek-ai/cordis";

//#region src/web/index.ts
const name = "graph-web";
const inject = [
	"graph",
	"sessions",
	"webServer"
];
const GRAPH_PATH = "/singular/graph";
const EVENTS_PATH = "/singular/events";
const TRANSCRIPT_PATH = "/singular/transcript";
const NOTICES_PATH = "/singular/notices";
function send(res, status, type, value) {
	res.writeHead(status, {
		"content-type": type,
		"cache-control": "no-store"
	});
	res.end(typeof value === "string" ? value : JSON.stringify(value));
}
function apply(ctx) {
	const clients = /* @__PURE__ */ new Set();
	const notices = /* @__PURE__ */ new Set();
	let previousStatuses = /* @__PURE__ */ new Map();
	const publishEvent = (name$1, value) => {
		const frame = `event: ${name$1}\ndata: ${JSON.stringify(value)}\n\n`;
		for (const res of clients) if (res.destroyed) clients.delete(res);
		else res.write(frame);
	};
	const publish = (snapshot) => {
		const frame = `event: graph\ndata: ${JSON.stringify(snapshot)}\n\n`;
		for (const res of clients) if (res.destroyed) clients.delete(res);
		else res.write(frame);
		for (const agent of snapshot.agents) {
			const previous = previousStatuses.get(agent.id);
			const text = previous === "running" && agent.status === "idle" ? "已完成当前任务" : agent.status === "done" ? "任务已完成" : agent.status === "failed" ? "任务执行失败" : agent.status === "waiting" ? "正在等待处理" : void 0;
			if (text === void 0 || previous === agent.status) continue;
			const frame$1 = `event: notice\ndata: ${JSON.stringify({
				agentId: agent.id,
				status: agent.status,
				text
			})}\n\n`;
			for (const res of notices) if (res.destroyed) notices.delete(res);
			else res.write(frame$1);
		}
		previousStatuses = new Map(snapshot.agents.map((agent) => [agent.id, agent.status]));
	};
	ctx.on("graph/change", publish);
	ctx.on("pr-bot/path", (event) => publishEvent("pr-bot/path", event));
	ctx.on("pr-bot/sent", (event) => publishEvent("pr-bot/sent", event));
	ctx.effect(() => {
		const graph = ctx.webServer.register({
			kind: "exact",
			path: GRAPH_PATH,
			handler: async (req, res) => {
				if (req.method !== "GET") {
					send(res, 405, "text/plain; charset=utf-8", "method not allowed");
					return;
				}
				send(res, 200, "application/json; charset=utf-8", await ctx.graph.snapshot());
			}
		});
		const events = ctx.webServer.register({
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
				clients.add(res);
				req.on("close", () => clients.delete(res));
				res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`);
			}
		});
		const transcript = ctx.webServer.register({
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
		const noticeEvents = ctx.webServer.register({
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
				notices.add(res);
				req.on("close", () => notices.delete(res));
			}
		});
		return () => {
			graph();
			events();
			transcript();
			noticeEvents();
			for (const res of clients) res.end();
			clients.clear();
			for (const res of notices) res.end();
			notices.clear();
		};
	}, "web: routes");
}

//#endregion
export { apply, inject, name };