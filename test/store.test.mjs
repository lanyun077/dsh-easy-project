import { ProjectStore } from "../store.js";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "dshep-test-"));
const store = new ProjectStore(root);

const p = store.create({ name: "测试项目", description: "smoke", folders: [{ path: "D:\\DPH", workspaceId: "w1" }] });
console.log("created:", p.id, p.name, "folders:", p.folders.length);

store.addFolder(p.id, { path: "C:\\Users\\81570\\.dsh", workspaceId: "w2" });
const dup = store.addFolder(p.id, { path: "D:\\DPH" });
console.log("dedupe keeps 2 folders:", dup.folders.length === 2);

store.attachSession(p.id, "session-aaa");
const other = store.create({ name: "第二个" });
store.attachSession(other.id, "session-aaa");
console.log("one session one project:", store.get(other.id).sessionIds.includes("session-aaa") && !store.get(p.id).sessionIds.includes("session-aaa"));

const map = store.sessionMap();
console.log("sessionMap:", map.get("session-aaa") === other.id);

const mem = store.appendMemory(p.id, "fact", "重要事实");
console.log("memory file written:", existsSync(mem));
store.writeInstructions(p.id, "规则1");
console.log("instructions roundtrip:", store.readInstructions(p.id) === "规则1");

store.detachSession(other.id, "session-aaa");
store.removeFolder(p.id, "C:\\Users\\81570\\.dsh");
store.remove(other.id);
const remaining = store.list();
console.log("remaining projects:", remaining.length, remaining[0].name, "sessions:", remaining[0].sessionIds.length, "folders:", remaining[0].folders.length);
const raw = JSON.parse(readFileSync(join(root, p.id, "project.json"), "utf8"));
console.log("format version stable:", raw.version === 1 && Array.isArray(raw.folders) && Array.isArray(raw.sessionIds));
console.log("SMOKE OK");
