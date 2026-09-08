import { Context } from "@deepseek-ai/cordis";

//#region src/constants.ts
const GRAPH_PATH = "/singular/graph";
const EVENTS_PATH = "/singular/events";
const TRANSCRIPT_PATH = "/singular/transcript";
const NOTICES_PATH = "/singular/notices";

//#endregion
//#region src/web/libs/http.ts
function send(res, status, type, value) {
	res.writeHead(status, {
		"content-type": type,
		"cache-control": "no-store"
	});
	res.end(typeof value === "string" ? value : JSON.stringify(value));
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
			res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`);
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
			send(res, 200, "application/json; charset=utf-8", await ctx.graph.snapshot());
		}
	});
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
	"sessions",
	"webServer"
];
function apply(ctx) {
	const broadcast = new GraphBroadcast();
	ctx.on("graph/change", (snapshot) => broadcast.publish(snapshot));
	ctx.on("pr-chat/path", (event) => broadcast.publishEvent("pr-chat/path", event));
	ctx.on("pr-chat/sent", (event) => broadcast.publishEvent("pr-chat/sent", event));
	ctx.effect(() => {
		const graph = registerGraph(ctx);
		const events = registerEvents(ctx, broadcast);
		const transcript = registerTranscript(ctx);
		const notices = registerNotices(ctx, broadcast);
		return () => {
			graph();
			events();
			transcript();
			notices();
			broadcast.close();
		};
	}, "web: routes");
}

//#endregion
export { apply, inject, name };