/**
 * dsh-easy-project — host half.
 *
 * A "project" entity that folds several folders + several sessions + one
 * shared memory/instruction set into a single grouping, layered on top of
 * DSH's session/workspace model (no core changes):
 *
 *   - a project registry under `<home>/.dsh/projects/<id>/` (project.json +
 *     AGENTS.md + PROJECT.md), served to the browser over `/api/dsh-easy-project/*`
 *   - per-session project-context injection: a global `project:context`
 *     system-prompt section whose `text` function renders the current agent's
 *     project (name / folders / AGENTS.md), plus a `agent/pre-step` hook that
 *     prepends PROJECT.md to the session's first user message (memory snapshot)
 *   - two agent tools: `project_memory_write` and `project_context`
 *   - a system-prompt announcement so agents know the plugin exists
 *
 * Inject services: `webServer` (HTTP routes), `tools` (agent tools),
 * `systemPrompt` (announcement + project context section).
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import z from "@deepseek-ai/schemastery";
import { MEMORY_CATEGORIES, ProjectStore } from "./store.js";

const name = "project";
const inject = ["webServer", "tools", "systemPrompt"];

/** The project-context system-prompt section name and order. */
const PROJECT_SECTION = "project:context";
const PROJECT_SECTION_ORDER = 300;
const ANNOUNCE_SECTION = "plugin:dsh-easy-project";
const ANNOUNCE_ORDER = 150;

/** Model-facing announcement: plugin presence, capabilities, and limits. */
const PROJECT_GUIDANCE =
  "本机已安装 dsh-easy-project 插件（DSH Web GUI 的「项目」）：把多个文件夹 + 多个会话 + 一份共享记忆/指令收敛到一个项目实体。能力：侧栏会话列表按项目分组（可切回原生视图）、项目可挂多个文件夹（自动注册为工作区）、新建会话时可同时勾选多个文件夹（会话跨文件夹工作，第一个勾选的为会话工作目录）、项目级 PROJECT.md 共享记忆（会话开始整体注入）、AGENTS.md 项目指令注入（system-prompt 段）；工具 project_memory_write（写入项目记忆）、project_context（读项目概览/指令/记忆）。限制：会话显式归属项目（在「项目」面板创建/加入），非自动按目录推断；项目数据存 ~/.dsh/projects/<id>/。用户提到「项目 / 项目文件夹 / 项目记忆」时即指本插件，请据此协作。";

/** Runtime schema for the dsh-easy-project row. */
const Config = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
  /** Projects root; default <home>/.dsh/projects. */
  dataDir: z.string().default(""),
});

// ── small HTTP helpers (mirror the dsh-ssh route family) ──────────────────
function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "referrer-policy": "no-referrer" });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > 256 * 1024) return undefined;
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function queryParam(url, name) {
  const value = url.searchParams.get(name);
  return value === null ? undefined : value;
}

/** Case-insensitive, separator-normalized path equality (Windows-friendly). */
function samePath(a, b) {
  const norm = (p) => String(p).replace(/[\\/]+/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/** Project summary for the browser (no file contents; those are per-detail). */
function summarize(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    folders: (project.folders ?? []).map((folder) => ({ path: folder.path, workspaceId: folder.workspaceId ?? "" })),
    sessionIds: [...(project.sessionIds ?? [])],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archived: Boolean(project.archived),
  };
}

function detail(store, project) {
  return {
    ...summarize(project),
    memory: store.readMemory(project.id),
    instructions: store.readInstructions(project.id),
  };
}

/** Build every /api/dsh-easy-project route. */
function makeRoutes(store, invalidate) {
  const BASE = "/api/dsh-easy-project";

  const guard = (req, res, method) => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: "forbidden: loopback-only" });
      return false;
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: `method not allowed: ${req.method}` });
      return false;
    }
    return true;
  };

  const requireProject = (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const id = queryParam(url, "id");
    if (id === undefined || id === "") {
      writeJson(res, 400, { error: "id query parameter is required" });
      return undefined;
    }
    const project = store.get(id);
    if (project === undefined) {
      writeJson(res, 404, { error: `project '${id}' not found` });
      return undefined;
    }
    return { url, id, project };
  };

  const routes = [
    // ── list / create ──────────────────────────────────────────────
    {
      kind: "exact",
      path: `${BASE}/projects`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if (req.method === "GET") {
          writeJson(res, 200, { projects: store.list().map(summarize) });
          return;
        }
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          if (body === undefined) {
            writeJson(res, 400, { error: "invalid JSON body" });
            return;
          }
          try {
            const project = store.create({
              name: body.name,
              description: body.description,
              folders: Array.isArray(body.folders) ? body.folders : [],
            });
            invalidate();
            writeJson(res, 201, { project: summarize(project) });
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        writeJson(res, 405, { error: `method not allowed: ${req.method}` });
      },
    },
    // ── detail / update / delete ───────────────────────────────────
    {
      kind: "exact",
      path: `${BASE}/project`,
      handler: async (req, res) => {
        const found = requireProject(req, res);
        if (found === undefined) return;
        if (req.method === "GET") {
          writeJson(res, 200, { project: detail(store, found.project) });
          return;
        }
        if (req.method === "PATCH") {
          const body = await readJsonBody(req);
          if (body === undefined) {
            writeJson(res, 400, { error: "invalid JSON body" });
            return;
          }
          try {
            let project = found.project;
            if (body.name !== undefined || body.description !== undefined) {
              project = store.update(found.id, { name: body.name, description: body.description });
            }
            if (body.instructions !== undefined) {
              project = store.writeInstructions(found.id, body.instructions);
            }
            invalidate();
            writeJson(res, 200, { project: detail(store, project) });
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (req.method === "DELETE") {
          const ok = store.remove(found.id);
          invalidate();
          writeJson(res, 200, { ok });
          return;
        }
        writeJson(res, 405, { error: `method not allowed: ${req.method}` });
      },
    },
    // ── folder add / remove ────────────────────────────────────────
    {
      kind: "exact",
      path: `${BASE}/folder`,
      handler: async (req, res) => {
        const found = requireProject(req, res);
        if (found === undefined) return;
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          if (body === undefined) {
            writeJson(res, 400, { error: "invalid JSON body" });
            return;
          }
          try {
            const project = store.addFolder(found.id, { path: body.path, workspaceId: body.workspaceId });
            invalidate();
            writeJson(res, 200, { project: summarize(project) });
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (req.method === "DELETE") {
          const url = found.url;
          const path = queryParam(url, "path");
          if (path === undefined || path === "") {
            writeJson(res, 400, { error: "path query parameter is required" });
            return;
          }
          const project = store.removeFolder(found.id, path);
          invalidate();
          writeJson(res, 200, { project: summarize(project) });
          return;
        }
        writeJson(res, 405, { error: `method not allowed: ${req.method}` });
      },
    },
    // ── session attach / detach ────────────────────────────────────
    {
      kind: "exact",
      path: `${BASE}/session`,
      handler: async (req, res) => {
        const found = requireProject(req, res);
        if (found === undefined) return;
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          if (body === undefined) {
            writeJson(res, 400, { error: "invalid JSON body" });
            return;
          }
          try {
            const project = store.attachSession(found.id, body.sessionId);
            invalidate();
            writeJson(res, 200, { project: summarize(project) });
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (req.method === "DELETE") {
          const url = found.url;
          const sessionId = queryParam(url, "sessionId");
          if (sessionId === undefined || sessionId === "") {
            writeJson(res, 400, { error: "sessionId query parameter is required" });
            return;
          }
          const project = store.detachSession(found.id, sessionId);
          invalidate();
          writeJson(res, 200, { project: summarize(project) });
          return;
        }
        writeJson(res, 405, { error: `method not allowed: ${req.method}` });
      },
    },
    // ── memory append (POST) / overwrite (PUT) ──────────────────────
    {
      kind: "exact",
      path: `${BASE}/memory`,
      handler: async (req, res) => {
        const found = requireProject(req, res);
        if (found === undefined) return;
        if (req.method !== "POST" && req.method !== "PUT") {
          writeJson(res, 405, { error: `method not allowed: ${req.method}` });
          return;
        }
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        const body = await readJsonBody(req);
        if (body === undefined) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        if (req.method === "PUT") {
          store.writeMemory(found.id, typeof body.content === "string" ? body.content : "");
          writeJson(res, 200, { ok: true });
          return;
        }
        const content = typeof body.content === "string" ? body.content.trim() : "";
        if (content === "") {
          writeJson(res, 400, { error: "content is required" });
          return;
        }
        const category = typeof body.category === "string" && MEMORY_CATEGORIES.includes(body.category) ? body.category : "fact";
        const path = store.appendMemory(found.id, category, content);
        writeJson(res, 200, { ok: true, category, path });
      },
    },
    // ── archive toggle ─────────────────────────────────────────────
    {
      kind: "exact",
      path: `${BASE}/archive`,
      handler: async (req, res) => {
        const found = requireProject(req, res);
        if (found === undefined) return;
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        const project = store.setArchived(found.id, body?.archived !== false);
        invalidate();
        writeJson(res, 200, { project: summarize(project) });
      },
    },
  ];

  return routes;
}

function buildMemoryInjection(text) {
  return (
    "\n\n---\n\n" +
    "[项目共享记忆 PROJECT.md — 由 dsh-easy-project 注入，本会话内保持此快照不变]\n\n" +
    text +
    "\n\n=====记忆文件结束=====\n\n" +
    "【本轮用户输入】：\n\n"
  );
}

function apply(ctx, config) {
  const cfg = config ?? {};
  const enabled = cfg.enabled ?? true;
  const announce = cfg.announceToAgent ?? true;
  if (!enabled) {
    ctx.logger.info("dsh-easy-project: disabled by config");
    return;
  }

  const store = new ProjectStore(cfg.dataDir || undefined);

  // sessionId -> projectId cache, invalidated after every durable mutation.
  let cache = new Map();
  let cacheDirty = true;
  const invalidate = () => {
    cacheDirty = true;
  };
  const projectForSession = (sessionId) => {
    if (sessionId === undefined || sessionId === "") return undefined;
    if (cacheDirty) {
      cache = store.sessionMap();
      cacheDirty = false;
    }
    const id = cache.get(sessionId);
    return id === undefined ? undefined : store.get(id);
  };

  // ── system-prompt: announcement + per-session project context ──────────
  let disposeAnnounce;
  const syncAnnounce = () => {
    if (disposeAnnounce) {
      disposeAnnounce();
      disposeAnnounce = undefined;
    }
    if (announce) {
      disposeAnnounce = ctx.systemPrompt.section({
        name: ANNOUNCE_SECTION,
        order: ANNOUNCE_ORDER,
        text: PROJECT_GUIDANCE,
      });
    }
  };

  // The project-context section is always registered; its text function renders
  // empty when the assembling session has no project, so the section is dropped
  // (renderPrompt filters empty sections). `context.scope` is the agent.
  const disposeProjectSection = ctx.systemPrompt.section({
    name: PROJECT_SECTION,
    order: PROJECT_SECTION_ORDER,
    text: (context) => {
      const agent = context?.scope;
      const sessionId = agent?.session?.id ?? agent?.id;
      const project = projectForSession(sessionId);
      if (project === undefined) return "";
      const instructions = store.readInstructions(project.id);
      const lines = [`当前会话属于项目「${project.name}」。`];
      if (project.description) lines.push(`项目简介：${project.description}`);
      const cwd = agent?.session?.header?.cwd ?? agent?.session?.cwd;
      if (project.folders?.length) {
        lines.push("项目文件夹（均属于本项目，可跨文件夹读取与检索；写入以会话工作目录为准）：");
        for (const folder of project.folders) {
          const isCwd = cwd !== undefined && samePath(cwd, folder.path);
          lines.push(`- ${folder.path}${isCwd ? "（当前会话工作目录）" : ""}`);
        }
      }
      if (instructions.trim()) {
        lines.push("");
        lines.push("项目指令（AGENTS.md，本项目所有会话共用）：");
        lines.push(instructions.trim());
      }
      return lines.join("\n");
    },
  });

  // ── memory snapshot injected before the session's first user message ───
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision === undefined || decision.kind !== "enter" || signal.aborted) return decision;
    if (decision.messages.length === 0) return decision;
    if (agent?.session?.header?.parentSession !== undefined) return decision;
    if (agent?.session?.events?.some((event) => event.type === "user/message")) return decision;
    const first = decision.messages[0];
    if (first?.source?.kind !== "user") return decision;
    const sessionId = agent?.session?.id ?? agent?.id;
    const project = projectForSession(sessionId);
    if (project === undefined) return decision;
    const memory = store.readMemory(project.id);
    if (!memory || !memory.trim()) return decision;
    const injected = buildMemoryInjection(memory);
    const rewritten = [{ ...first, content: [{ type: "text", text: injected }, ...first.content] }, ...decision.messages.slice(1)];
    return { ...decision, messages: rewritten };
  });

  // ── routes ─────────────────────────────────────────────────────────────
  const disposeRoutes = ctx.effect(
    () => {
      const disposers = makeRoutes(store, invalidate).map((route) => ctx.webServer.register(route));
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "dsh-easy-project: routes",
  );

  // ── tools ──────────────────────────────────────────────────────────────
  const projectMemoryWrite = defineTool({
    name: "project_memory_write",
    description:
      "把一条值得跨会话记住的信息写入当前项目的 PROJECT.md（按分类追加）。当前项目的所有会话共享这一份记忆；新会话开始时整体注入，所以只写值得长久记住的内容。" +
      "category 分类：fact=重要事实与决定；mistake=纠错与教训（被用户纠正过的记这里）；preference=用户偏好（交流/工作/代码风格、项目相关偏好）；user_said=用户对项目的珍贵原话；lesson=经验与意外（多次尝试才成功的经验、踩过的坑、意外发现）；detail=关键细节（花了很多轮才找到、以后还会用到的重要细节）。" +
      "content 写一条简洁完整的句子（建议不超过 200 字），直接陈述事实本身。调用成功后工具会返回确认，无需重复调用。",
    parameters: {
      content: { type: "string", required: true, description: "要记住的内容，一条简洁完整的句子。" },
      category: { type: "string", enum: MEMORY_CATEGORIES, default: "fact", description: "记忆分类，默认 fact。" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          project: { type: "string" },
          category: { type: "string" },
          path: { type: "string" },
        },
      },
      render: (_args, value) => [
        { type: "text", text: `✅ 项目记忆已写入（项目「${value.project ?? "?"}」，分类 ${value.category ?? "fact"}）。无需重复调用。` },
      ],
    },
    async execute(args, exec) {
      const content = typeof args.content === "string" ? args.content.trim() : "";
      if (content === "") throw new Error("project_memory_write: content 不能为空");
      const category = typeof args.category === "string" && MEMORY_CATEGORIES.includes(args.category) ? args.category : "fact";
      const sessionId = exec?.agent?.session?.id ?? exec?.agent?.id;
      const project = projectForSession(sessionId);
      if (project === undefined) {
        throw new Error("project_memory_write: 当前会话不属于任何项目（请先在「项目」面板创建或加入项目）");
      }
      const path = store.appendMemory(project.id, category, content);
      return { ok: true, project: project.name, category, path };
    },
  });

  const projectContext = defineTool({
    name: "project_context",
    description:
      "读取当前项目的概览：名称、描述、文件夹清单、项目指令（AGENTS.md）与项目共享记忆（PROJECT.md）。用于了解当前会话所处的项目上下文。",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          inProject: { type: "boolean", required: true },
          project: { type: "string" },
          description: { type: "string" },
          folders: { type: "array", items: { type: "string" } },
          instructions: { type: "string" },
          memory: { type: "string" },
        },
      },
      render: (_args, value) => {
        if (!value.inProject) return [{ type: "text", text: "当前会话不属于任何项目。" }];
        const parts = [`项目「${value.project ?? "?"}」`];
        if (value.description) parts.push(`简介：${value.description}`);
        if (value.folders?.length) parts.push(`文件夹：\n${value.folders.map((folder) => `- ${folder}`).join("\n")}`);
        if (value.instructions?.trim()) parts.push(`指令（AGENTS.md）：\n${value.instructions.trim()}`);
        if (value.memory?.trim()) parts.push(`共享记忆（PROJECT.md）：\n${value.memory.trim()}`);
        return [{ type: "text", text: parts.join("\n\n") }];
      },
    },
    async execute(_args, exec) {
      const sessionId = exec?.agent?.session?.id ?? exec?.agent?.id;
      const project = projectForSession(sessionId);
      if (project === undefined) return { inProject: false };
      return {
        inProject: true,
        project: project.name,
        description: project.description ?? "",
        folders: (project.folders ?? []).map((folder) => folder.path),
        instructions: store.readInstructions(project.id),
        memory: store.readMemory(project.id),
      };
    },
  });

  const disposeTools = ctx.effect(
    () => {
      const disposers = [projectMemoryWrite, projectContext].map((tool) => ctx.tools.register(tool));
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "dsh-easy-project: tools",
  );

  syncAnnounce();

  ctx.effect(
    () => () => {
      if (disposeAnnounce) disposeAnnounce();
      disposeProjectSection();
    },
    "dsh-easy-project: cleanup",
  );
}

export { Config, apply, inject, name };
