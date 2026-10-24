/**
 * dsh-easy-project — project store.
 *
 * Pure file I/O (no cordis dependency, unit-testable): one JSON record per
 * project under `<home>/.dsh/projects/<id>/project.json`, with `AGENTS.md`
 * (project instructions) and `PROJECT.md` (shared memory) beside it.
 *
 * Writes are atomic (tmp + rename). A corrupt `project.json` is renamed aside
 * for manual recovery rather than silently overwritten, so a bad file never
 * bricks the plugin and never loses data behind its back.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const FORMAT_VERSION = 1;

/** Memory categories (mirror meow-memory for a consistent feel). */
export const MEMORY_CATEGORIES = ["fact", "mistake", "preference", "user_said", "lesson", "detail"];

const CATEGORY_LABELS = {
  fact: "重要事实与决定",
  mistake: "纠错与教训",
  preference: "用户偏好",
  user_said: "用户原话",
  lesson: "经验与意外",
  detail: "关键细节",
};

const MEMORY_HEADER = [
  "# PROJECT.md — 项目共享记忆",
  "",
  "> 由 dsh-easy-project 维护（可手动编辑）。本项目的所有会话共享这一份记忆；",
  "> 每个会话开始时整体注入，会话内不自动更新。保持精简，只写值得长久记住的内容。",
  "",
].join("\n");

/** The projects root: <home>/.dsh/projects. */
export function projectsRoot() {
  return join(homedir(), ".dsh", "projects");
}

function readFile(path) {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function writeFileAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

function sectionTitle(category) {
  return `## ${CATEGORY_LABELS[category] ?? category} (${category})`;
}

/**
 * The durable project registry. All reads go through the per-id JSON file; all
 * writes funnel through `_save` so the `updatedAt` stamp happens exactly once.
 */
export class ProjectStore {
  constructor(root) {
    this.root = root ?? projectsRoot();
  }

  dirOf(id) {
    return join(this.root, id);
  }

  // ── read surface ────────────────────────────────────────────────────────
  list() {
    if (!existsSync(this.root)) return [];
    const out = [];
    for (const name of readdirSync(this.root)) {
      const record = this._load(name);
      if (record !== undefined) out.push(record);
    }
    return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  get(id) {
    return this._load(id);
  }

  /** Map of sessionId -> projectId across every project (injection lookup). */
  sessionMap() {
    const map = new Map();
    for (const project of this.list()) {
      for (const sessionId of project.sessionIds) map.set(sessionId, project.id);
    }
    return map;
  }

  // ── write surface ───────────────────────────────────────────────────────
  create({ name, description = "", folders = [] }) {
    if (typeof name !== "string" || name.trim() === "") throw new Error("project name is required");
    const id = "p_" + randomUUID().slice(0, 8);
    const now = Date.now();
    const record = {
      version: FORMAT_VERSION,
      id,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      folders: folders.map((folder) => ({
        path: folder.path,
        workspaceId: folder.workspaceId ?? "",
      })),
      sessionIds: [],
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    this._save(id, record);
    writeFileAtomic(join(this.dirOf(id), "AGENTS.md"), "");
    writeFileAtomic(join(this.dirOf(id), "PROJECT.md"), MEMORY_HEADER);
    return record;
  }

  update(id, { name, description } = {}) {
    const record = this._require(id);
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") throw new Error("project name is required");
      record.name = name.trim();
    }
    if (description !== undefined) record.description = typeof description === "string" ? description.trim() : "";
    this._save(id, record);
    return record;
  }

  remove(id) {
    if (!existsSync(this.dirOf(id))) return false;
    rmSync(this.dirOf(id), { recursive: true, force: true });
    return true;
  }

  addFolder(id, { path, workspaceId = "" }) {
    if (typeof path !== "string" || path.trim() === "") throw new Error("folder path is required");
    const record = this._require(id);
    const canonical = path.trim();
    if (record.folders.some((folder) => folder.path === canonical)) return record;
    record.folders.push({ path: canonical, workspaceId });
    this._save(id, record);
    return record;
  }

  removeFolder(id, path) {
    const record = this._require(id);
    record.folders = record.folders.filter((folder) => folder.path !== path);
    this._save(id, record);
    return record;
  }

  attachSession(id, sessionId) {
    if (typeof sessionId !== "string" || sessionId === "") throw new Error("sessionId is required");
    const record = this._require(id);
    if (record.sessionIds.includes(sessionId)) return record;
    // One session belongs to at most one project: detach it everywhere else first.
    for (const other of this.list()) {
      if (other.id !== id && other.sessionIds.includes(sessionId)) {
        other.sessionIds = other.sessionIds.filter((sid) => sid !== sessionId);
        this._save(other.id, other);
      }
    }
    record.sessionIds.push(sessionId);
    this._save(id, record);
    return record;
  }

  detachSession(id, sessionId) {
    const record = this._require(id);
    record.sessionIds = record.sessionIds.filter((sid) => sid !== sessionId);
    this._save(id, record);
    return record;
  }

  setArchived(id, archived) {
    const record = this._require(id);
    record.archived = Boolean(archived);
    this._save(id, record);
    return record;
  }

  // ── memory / instructions ───────────────────────────────────────────────
  readMemory(id) {
    return readFile(join(this.dirOf(id), "PROJECT.md"));
  }

  appendMemory(id, category, content) {
    const path = join(this.dirOf(id), "PROJECT.md");
    const entry = `- ${content}\n`;
    let text;
    if (!existsSync(path)) {
      const sections = MEMORY_CATEGORIES.map(
        (cat) => sectionTitle(cat) + (cat === category ? `\n${entry}` : ""),
      );
      text = MEMORY_HEADER + "\n" + sections.join("\n\n");
    } else {
      text = readFile(path) || "";
      const title = sectionTitle(category);
      const at = text.indexOf(title);
      if (at !== -1) {
        text = text.slice(0, at + title.length) + `\n${entry}` + text.slice(at + title.length);
      } else {
        text = text.replace(/\s*$/, "") + "\n\n" + title + `\n${entry}`;
      }
    }
    writeFileAtomic(path, text);
    return path;
  }

  writeMemory(id, text) {
    const record = this._require(id);
    writeFileAtomic(join(this.dirOf(id), "PROJECT.md"), typeof text === "string" ? text : MEMORY_HEADER);
    this._save(id, record);
    return record;
  }

  readInstructions(id) {
    return readFile(join(this.dirOf(id), "AGENTS.md"));
  }

  writeInstructions(id, text) {
    const record = this._require(id);
    writeFileAtomic(join(this.dirOf(id), "AGENTS.md"), typeof text === "string" ? text : "");
    this._save(id, record);
    return record;
  }

  // ── internals ───────────────────────────────────────────────────────────
  _require(id) {
    const record = this._load(id);
    if (record === undefined) throw new Error(`project '${id}' not found`);
    return record;
  }

  _load(id) {
    const path = join(this.dirOf(id), "project.json");
    if (!existsSync(path)) return undefined;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (typeof parsed !== "object" || parsed === null || typeof parsed.id !== "string" || !Array.isArray(parsed.folders) || !Array.isArray(parsed.sessionIds)) {
        throw new Error("project.json shape invalid");
      }
      return parsed;
    } catch {
      try {
        renameSync(path, `${path}.corrupt-${Date.now()}`);
      } catch {
        /* best effort */
      }
      return undefined;
    }
  }

  _save(id, record) {
    record.version = FORMAT_VERSION;
    record.updatedAt = Date.now();
    const dir = this.dirOf(id);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "project.json");
    const tmp = path + ".tmp";
    writeFileSync(tmp, JSON.stringify(record, null, 2) + "\n", "utf8");
    renameSync(tmp, path);
  }
}
