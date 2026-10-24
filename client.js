/**
 * dsh-easy-project — browser half.
 *
 * Hand-written ModuleLoader bundle (no build step). One DOM surface:
 *
 *   the sidebar session-list takeover. The sidebar's regionArea shows a clean,
 *   Codex-like project-grouped session list — 项目 → 会话 groups plus 未分组
 *   and 已归档. Every row carries its operations:
 *
 *   - project row: hover ＋ (multi-folder new session) / ⋯ menu, and a native
 *     right-click context menu (新建会话 / 添加文件夹 / 添加会话 / 重命名 /
 *     指令 / 记忆 / 归档 / 删除)
 *   - session row in a project: right-click → 打开 / 移出项目
 *   - ungrouped session row: right-click → 打开 / 加入项目
 *
 *   Sessions bound to a project but absent from the runtime snapshot render as
 *   muted placeholder rows so containment stays visible. There is no separate
 *   management panel — all management lives in the menus and modals.
 *
 * Data access: plain `fetch` against the host's `/api/dsh-easy-project/*` route
 * family (see Api), plus the client runtime's `sessions` / `workspaces`
 * services for creating/opening sessions and registering workspaces.
 *
 * Failure policy: DOM mounting problems are logged, never thrown — an
 * external plugin must not take the GUI down.
 */
window.__ModuleLoader__.load({
  id: "dsh-easy-project",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;
    var createRoot = require("react-dom/client").createRoot;

    // ── CSS ────────────────────────────────────────────────────────────────
    var CSS =
      "/* --- generic bits --- */" +
      ".dp-empty{padding:32px 8px;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary)}" +
      ".dp-error{padding:8px 10px;font-size:12px;color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-secondary,transparent);border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px}" +
      ".dp-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".dp-folder{display:flex;align-items:center;gap:8px;padding:3px 0}" +
      ".dp-folderPath{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-markdown-code-block-small,monospace)}" +
      "/* --- buttons --- */" +
      ".dp-btn{padding:5px 12px;font-size:12px;color:var(--dsw-alias-label-primary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;cursor:pointer;white-space:nowrap;font-family:inherit}" +
      ".dp-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}" +
      ".dp-btn:disabled{opacity:.45;cursor:default}" +
      ".dp-btnPrimary{padding:6px 14px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-button-info-fill);border:none;border-radius:8px;cursor:pointer;white-space:nowrap;font-family:inherit}" +
      ".dp-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}" +
      ".dp-btnPrimary:disabled{opacity:.5;cursor:default}" +
      ".dp-link{padding:0;font-size:12px;color:var(--dsw-alias-state-business-primary);background:none;border:none;cursor:pointer;white-space:nowrap;font-family:inherit}" +
      ".dp-link:hover{text-decoration:underline}" +
      "/* --- modal --- */" +
      ".dp-backdrop{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1)}" +
      ".dp-modal{display:flex;flex-direction:column;gap:12px;width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 96px);overflow-y:auto;padding:18px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary)}" +
      ".dp-modalTitle{margin:0;font-size:15px;font-weight:700}" +
      ".dp-field{display:flex;flex-direction:column;gap:5px}" +
      ".dp-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}" +
      ".dp-input{padding:7px 10px;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;outline:none;resize:vertical;font-family:inherit}" +
      ".dp-textarea{min-height:120px;font-family:var(--dsw-font-markdown-code-block-small,monospace);font-size:12.5px}" +
      ".dp-input:focus{border-color:var(--dsw-alias-state-business-primary)}" +
      ".dp-modalFooter{display:flex;justify-content:flex-end;gap:10px;margin-top:4px}" +
      ".dp-pickList{display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px}" +
      ".dp-pickRow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12.5px}" +
      ".dp-pickRow:hover{background:var(--dsw-alias-interactive-bg-hover)}" +
      ".dp-pickRow[data-in]{opacity:.45;cursor:default}" +
      ".dp-pickCheck{flex:none;accent-color:var(--dsw-alias-state-business-primary)}" +
      ".dp-pickLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}" +
      ".dp-pickMeta{flex:none;max-width:45%;font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".dp-group{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}" +
      ".dp-groupHead{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--dsw-alias-bg-layer-2)}" +
      ".dp-groupHead:hover{background:var(--dsw-alias-interactive-bg-hover)}" +
      ".dp-groupToggle{flex:none;width:12px;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center;cursor:pointer}" +
      ".dp-groupName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-markdown-code-block-small,monospace);font-size:12px;cursor:pointer}" +
      ".dp-groupCount{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".dp-groupChildren{display:flex;flex-direction:column;gap:2px;padding:6px 6px 6px 30px;border-top:1px solid var(--dsw-alias-border-l1)}" +
      "/* --- context menu --- */" +
      ".psv-menu{position:fixed;z-index:1400;min-width:190px;max-height:70vh;overflow-y:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:var(--dsw-shadow-lv3);padding:4px;display:flex;flex-direction:column;gap:1px;font-family:var(--dsw-font-family)}" +
      ".psv-menuItem{display:flex;align-items:center;padding:6px 10px;border-radius:6px;cursor:pointer;color:var(--dsw-alias-label-primary);background:none;border:none;text-align:left;font-size:12.5px;font-family:inherit;white-space:nowrap}" +
      ".psv-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}" +
      ".psv-menuItem[data-danger]{color:var(--dsw-alias-state-error-primary)}" +
      ".psv-menuSep{height:1px;background:var(--dsw-alias-border-l1);margin:3px 6px;flex:none}" +
      "/* --- sidebar project view --- */" +
      "[data-dsh-easy-projects-list]{display:flex;flex-direction:column;flex:1;min-height:0}" +
      "[data-dsh-easy-projects-list] .psv-body{display:flex;flex:1;min-height:0;flex-direction:column;gap:2px;overflow-y:auto;padding-right:2px}" +
      "[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='regionArea'] > :not([data-dsh-easy-projects-list]){display:none!important}" +
      "[data-dsh-frame][data-sidebar-collapsed] [data-dsh-easy-projects-list]{display:none}" +
      ".psv-head{display:flex;align-items:center;gap:6px;padding:2px 6px 6px;flex:none}" +
      ".psv-headLabel{font-size:11px;font-weight:700;letter-spacing:.03em;color:var(--dsw-alias-label-tertiary)}" +
      ".psv-headBtn{margin-left:auto;padding:2px 9px;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;cursor:pointer;white-space:nowrap;font-family:inherit}" +
      ".psv-headBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
      ".psv-group{display:flex;flex-direction:column;min-width:0}" +
      ".psv-groupHead{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary)}" +
      ".psv-groupHead:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}" +
      ".psv-chev{flex:none;width:12px;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary)}" +
      ".psv-gName{flex:1;min-width:0;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".psv-gCount{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".psv-act{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;opacity:0;transition:opacity .12s;font-family:inherit}" +
      ".psv-groupHead:hover .psv-act{opacity:1}" +
      ".psv-act:hover{background:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}" +
      ".psv-sessions{display:flex;flex-direction:column;gap:1px;padding:0 0 2px 14px}" +
      ".psv-row{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;cursor:pointer;color:var(--dsw-alias-label-secondary)}" +
      ".psv-row:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}" +
      ".psv-row[data-current]{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active)}" +
      ".psv-row[data-ghost]{opacity:.55}" +
      ".psv-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-border-l3)}" +
      ".psv-row[data-current] .psv-dot{background:var(--dsw-alias-state-business-primary)}" +
      ".psv-label{flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".psv-empty{padding:10px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".psv-archHead{opacity:.7}" +
      ".psv-cwdHint{font-size:11px;color:var(--dsw-alias-label-tertiary);word-break:break-all}";

    var tagId = "dsh-easy-project/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var styleTag = document.createElement("style");
      styleTag.dataset.plugin = "dsh-easy-project";
      styleTag.dataset.pluginCss = tagId;
      styleTag.textContent = CSS;
      document.head.appendChild(styleTag);
    }

    // ── API client ─────────────────────────────────────────────────────────
    function Api() {
      var BASE = "/api/dsh-easy-project";
      function q(params) {
        var s = new URLSearchParams();
        for (var k in params) {
          if (params[k] !== undefined && params[k] !== "") s.set(k, String(params[k]));
        }
        var t = s.toString();
        return t ? "?" + t : "";
      }
      async function readJson(res) {
        var body;
        try {
          body = await res.json();
        } catch (e) {
          throw new Error("HTTP " + res.status + ": invalid JSON");
        }
        if (!res.ok) throw new Error((body && body.error) || ("HTTP " + res.status));
        return body;
      }
      function post(path, body) {
        return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      }
      return {
        list: async function () {
          var r = await readJson(await fetch(BASE + "/projects"));
          return r.projects;
        },
        create: async function (p) {
          var r = await readJson(await post(BASE + "/projects", p));
          return r.project;
        },
        detail: async function (id) {
          var r = await readJson(await fetch(BASE + "/project" + q({ id: id })));
          return r.project;
        },
        update: async function (id, p) {
          var r = await readJson(await fetch(BASE + "/project" + q({ id: id }), {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(p || {}),
          }));
          return r.project;
        },
        remove: async function (id) {
          await readJson(await fetch(BASE + "/project" + q({ id: id }), { method: "DELETE" }));
        },
        addFolder: async function (id, p) {
          var r = await readJson(await post(BASE + "/folder" + q({ id: id }), p));
          return r.project;
        },
        removeFolder: async function (id, path) {
          var r = await readJson(await fetch(BASE + "/folder" + q({ id: id, path: path }), { method: "DELETE" }));
          return r.project;
        },
        attachSession: async function (id, sessionId) {
          var r = await readJson(await post(BASE + "/session" + q({ id: id }), { sessionId: sessionId }));
          return r.project;
        },
        detachSession: async function (id, sessionId) {
          var r = await readJson(await fetch(BASE + "/session" + q({ id: id, sessionId: sessionId }), { method: "DELETE" }));
          return r.project;
        },
        appendMemory: async function (id, content, category) {
          return readJson(await post(BASE + "/memory" + q({ id: id }), { content: content, category: category }));
        },
        writeMemory: async function (id, content) {
          return readJson(await fetch(BASE + "/memory" + q({ id: id }), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: content }),
          }));
        },
        archive: async function (id, archived) {
          var r = await readJson(await post(BASE + "/archive" + q({ id: id }), { archived: archived }));
          return r.project;
        },
      };
    }

    // ── sidebar session-list takeover (self-healing) ───────────────────────
    function sidebarRegionArea() {
      var column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
      if (column === null) return undefined;
      var region = column.querySelector('[class*="regionArea"]');
      return region ?? undefined;
    }

    function mountSessionList(api, sessions, workspaces) {
      if (typeof document !== "undefined" && document.querySelector("[data-dsh-easy-projects-list]") !== null) {
        return function () {};
      }
      var container = document.createElement("div");
      container.dataset.dshProjectsList = "";
      var root;
      var mounted = false;
      var region;

      function ensure() {
        if (mounted) {
          if (document.body.contains(container)) return;
          if (root) {
            root.unmount();
            root = undefined;
          }
          container.remove();
          mounted = false;
        }
        region = sidebarRegionArea();
        if (region === undefined) return;
        region.insertBefore(container, region.firstChild);
        root = createRoot(container);
        root.render(h(SessionListView, { api: api, sessions: sessions, workspaces: workspaces }));
        mounted = true;
      }

      var waitObserver = new MutationObserver(function () {
        ensure();
      });
      waitObserver.observe(document.body, { childList: true, subtree: true });
      ensure();

      return function () {
        waitObserver.disconnect();
        if (root) root.unmount();
        root = undefined;
        container.remove();
        mounted = false;
      };
    }

    // ── helpers ────────────────────────────────────────────────────────────
    function sessionLabel(summary) {
      if (!summary) return "…";
      var title = summary.title || (summary.projections && summary.projections.values && summary.projections.values.title);
      if (title) return title;
      if (summary.cwd) {
        var parts = String(summary.cwd).split(/[\\/]/);
        return parts[parts.length - 1] || summary.cwd;
      }
      return String(summary.sessionId || "").slice(0, 8);
    }

    function ghostLabel(sessionId) {
      return "会话 " + String(sessionId).replace(/^session-/, "").slice(0, 8) + "…";
    }

    function folderLabel(path) {
      var parts = String(path).split(/[\\/]/);
      return parts[parts.length - 1] || path;
    }

    function extractSessionId(result) {
      if (typeof result === "string") return result;
      return (result && result.value && result.value.sessionId) || (result && result.sessionId);
    }

    function loadCollapsed() {
      try {
        return JSON.parse(window.localStorage.getItem("dsh-easy-project:collapsed") || "{}") || {};
      } catch (e) {
        return {};
      }
    }

    function saveCollapsed(map) {
      try {
        window.localStorage.setItem("dsh-easy-project:collapsed", JSON.stringify(map));
      } catch (e) { /* best effort */ }
    }

    // ── context menu ───────────────────────────────────────────────────────
    function ContextMenu(props) {
      var ref = react.useRef(null);
      var posState = react.useState({ x: props.x, y: props.y });
      react.useLayoutEffect(function () {
        var el = ref.current;
        if (el === null) return;
        var rect = el.getBoundingClientRect();
        var x = props.x;
        var y = props.y;
        if (x + rect.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 8 - rect.width);
        if (y + rect.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - 8 - rect.height);
        posState[1]({ x: x, y: y });
      }, []);
      react.useEffect(function () {
        function onDown(e) {
          if (ref.current !== null && ref.current.contains(e.target)) return;
          props.onClose();
        }
        function onKey(e) {
          if (e.key === "Escape") props.onClose();
        }
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", props.onClose);
        return function () {
          document.removeEventListener("mousedown", onDown, true);
          document.removeEventListener("keydown", onKey, true);
          window.removeEventListener("resize", props.onClose);
        };
      }, []);
      return h("div", {
        ref: ref,
        className: "psv-menu",
        style: { left: posState[0].x + "px", top: posState[0].y + "px" },
        onContextMenu: function (e) { e.preventDefault(); },
      },
        props.items.map(function (item, i) {
          if (item.sep) return h("div", { key: i, className: "psv-menuSep" });
          return h("button", {
            key: i,
            type: "button",
            className: "psv-menuItem",
            "data-danger": item.danger ? "" : null,
            onClick: function () { props.onClose(); item.onClick(); },
          }, item.label);
        }));
    }

    // ── modal components ───────────────────────────────────────────────────
    function CreateModal(props) {
      var nameState = react.useState("");
      var descriptionState = react.useState("");
      var foldersState = react.useState([]);
      var pickingState = react.useState(false);
      var errState = react.useState(null);
      var busyState = react.useState(false);
      var name = nameState[0];
      var setName = nameState[1];
      var description = descriptionState[0];
      var setDescription = descriptionState[1];
      var folders = foldersState[0];
      var setFolders = foldersState[1];
      var picking = pickingState[0];
      var setPicking = pickingState[1];
      var err = errState[0];
      var setErr = errState[1];
      var busy = busyState[0];
      var setBusy = busyState[1];

      function addFolder() {
        setPicking(true);
        setErr(null);
        props.workspaces.pickDirectory().then(function (path) {
          if (path == null) {
            setPicking(false);
            return;
          }
          return props.workspaces.create({ path: path }).then(function (ws) {
            setFolders(function (prev) {
              if (prev.some(function (f) { return f.path === ws.path; })) return prev;
              return prev.concat([{ path: ws.path, workspaceId: ws.workspaceId }]);
            });
            setPicking(false);
          });
        }).catch(function (e) {
          setPicking(false);
          setErr(String((e && e.message) || e));
        });
      }

      function removeFolder(index) {
        setFolders(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
      }

      function submit() {
        if (name.trim() === "") {
          setErr("请输入项目名称");
          return;
        }
        setBusy(true);
        props.onSubmit({ name: name, description: description, folders: folders }, function () { setBusy(false); });
      }

      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget && !busy) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, "新建项目"),
          h("label", { className: "dp-field" },
            h("span", { className: "dp-label" }, "项目名称"),
            h("input", { className: "dp-input", value: name, autoFocus: true, placeholder: "例如：我的产品", onChange: function (e) { setName(e.target.value); } })
          ),
          h("label", { className: "dp-field" },
            h("span", { className: "dp-label" }, "项目简介（可选）"),
            h("input", { className: "dp-input", value: description, onChange: function (e) { setDescription(e.target.value); } })
          ),
          h("div", { className: "dp-field" },
            h("span", { className: "dp-label" }, "文件夹（可多个，每个自动注册为工作区）"),
            folders.length === 0 ? h("span", { className: "dp-hint" }, "尚未添加文件夹") : null,
            folders.map(function (f, i) {
              return h("div", { key: f.path, className: "dp-folder" },
                h("span", { className: "dp-folderPath" }, f.path),
                h("button", { type: "button", className: "dp-link", onClick: function () { removeFolder(i); } }, "移除"));
            }),
            h("button", { type: "button", className: "dp-btn", onClick: addFolder, disabled: picking }, picking ? "选择中…" : "＋ 添加文件夹")
          ),
          err ? h("p", { className: "dp-error" }, err) : null,
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel, disabled: busy }, "取消"),
            h("button", { type: "button", className: "dp-btnPrimary", onClick: submit, disabled: busy }, busy ? "创建中…" : "创建"))
        )
      );
    }

    function EditModal(props) {
      var nameState = react.useState(props.name || "");
      var descState = react.useState(props.description || "");
      var name = nameState[0];
      var setName = nameState[1];
      var desc = descState[0];
      var setDesc = descState[1];

      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, "重命名项目"),
          h("label", { className: "dp-field" },
            h("span", { className: "dp-label" }, "项目名称"),
            h("input", { className: "dp-input", value: name, autoFocus: true, onChange: function (e) { setName(e.target.value); } })
          ),
          h("label", { className: "dp-field" },
            h("span", { className: "dp-label" }, "项目简介"),
            h("input", { className: "dp-input", value: desc, onChange: function (e) { setDesc(e.target.value); } })
          ),
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel }, "取消"),
            h("button", { type: "button", className: "dp-btnPrimary", onClick: function () { props.onSubmit({ name: name, description: desc }); }, disabled: props.busy }, "保存"))
        )
      );
    }

    function TextModal(props) {
      var valueState = react.useState(props.value || "");
      var value = valueState[0];
      var setValue = valueState[1];

      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, props.title),
          h("label", { className: "dp-field" },
            h("span", { className: "dp-label" }, props.hint),
            h("textarea", { className: "dp-input dp-textarea", value: value, onChange: function (e) { setValue(e.target.value); } })
          ),
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel }, "取消"),
            h("button", { type: "button", className: "dp-btnPrimary", onClick: function () { props.onSubmit(value); }, disabled: props.busy }, "保存"))
        )
      );
    }

    function TriCheckbox(props) {
      var ref = react.useRef(null);
      react.useEffect(function () {
        if (ref.current) ref.current.indeterminate = !!props.indeterminate;
      }, [props.indeterminate]);
      return h("input", { type: "checkbox", ref: ref, className: "dp-pickCheck", checked: props.checked, disabled: props.disabled, onChange: props.onChange });
    }

    function SessionPickerModal(props) {
      var selectedState = react.useState({});
      var filterState = react.useState("");
      var openState = react.useState({});
      var selected = selectedState[0];
      var setSelected = selectedState[1];
      var filter = filterState[0];
      var setFilter = filterState[1];
      var open = openState[0];
      var setOpen = openState[1];

      var owner = {};
      (props.projects || []).forEach(function (p) {
        (p.sessionIds || []).forEach(function (sid) { owner[sid] = p.name; });
      });

      var groups = {};
      (props.sessionSnap.ids || []).forEach(function (sid) {
        var summary = props.sessionSnap.byId ? props.sessionSnap.byId[sid] : undefined;
        var cwd = (summary && summary.cwd) || "（未分组）";
        (groups[cwd] = groups[cwd] || []).push(sid);
      });
      var cwds = Object.keys(groups).sort();

      var f = filter.trim().toLowerCase();

      function isSel(sid) { return !!selected[sid]; }
      function setOne(sid, on) {
        setSelected(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; if (on) n[sid] = true; else delete n[sid]; return n; });
      }
      function selectable(cwd) {
        return groups[cwd].filter(function (sid) { return (props.projectSessionIds || []).indexOf(sid) === -1; });
      }
      function toggleGroup(cwd) {
        var ids = selectable(cwd);
        if (ids.length === 0) return;
        var all = ids.every(isSel);
        setSelected(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; ids.forEach(function (sid) { if (all) delete n[sid]; else n[sid] = true; }); return n; });
      }
      function toggleOpen(cwd) {
        setOpen(function (prev) { var n = {}; for (var k in prev) n[k] = prev[k]; n[cwd] = !n[cwd]; return n; });
      }

      function renderSessionRow(sid) {
        var summary = props.sessionSnap.byId ? props.sessionSnap.byId[sid] : undefined;
        var inThis = (props.projectSessionIds || []).indexOf(sid) !== -1;
        var meta = inThis ? "已在项目中" : (owner[sid] ? "已在「" + owner[sid] + "」" : "");
        return h("label", { key: sid, className: "dp-pickRow", "data-in": inThis ? "" : null },
          h("input", { type: "checkbox", className: "dp-pickCheck", checked: isSel(sid), disabled: inThis, onChange: function (e) { setOne(sid, e.target.checked); } }),
          h("span", { className: "dp-pickLabel" }, sessionLabel(summary)),
          meta ? h("span", { className: "dp-pickMeta" }, meta) : null);
      }

      var groupsEl = cwds.map(function (cwd) {
        var ids = groups[cwd];
        var nameMatch = !f || cwd.toLowerCase().indexOf(f) !== -1;
        var visibleIds = f && !nameMatch ? ids.filter(function (sid) {
          var summary = props.sessionSnap.byId ? props.sessionSnap.byId[sid] : undefined;
          return sessionLabel(summary).toLowerCase().indexOf(f) !== -1;
        }) : ids;
        if (!nameMatch && visibleIds.length === 0) return null;

        var sel = selectable(cwd);
        var checked = sel.length > 0 && sel.every(isSel);
        var indeterminate = !checked && sel.some(isSel);
        var isOpen = f ? true : !!open[cwd];

        return h("div", { key: cwd, className: "dp-group" },
          h("div", { className: "dp-groupHead" },
            h(TriCheckbox, { checked: checked, indeterminate: indeterminate, disabled: sel.length === 0, onChange: function () { toggleGroup(cwd); } }),
            h("span", { className: "dp-groupToggle", onClick: function () { toggleOpen(cwd); } }, isOpen ? "▾" : "▸"),
            h("span", { className: "dp-groupName", title: cwd, onClick: function () { toggleOpen(cwd); } }, cwd),
            h("span", { className: "dp-groupCount" }, ids.length + " 会话")),
          isOpen ? h("div", { className: "dp-groupChildren" }, visibleIds.map(renderSessionRow)) : null);
      }).filter(function (r) { return r !== null; });

      var chosen = Object.keys(selected).filter(function (k) { return selected[k]; });

      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, "添加会话到项目「" + props.projectName + "」"),
          h("input", { className: "dp-input", placeholder: "搜索会话（标题/目录）…", value: filter, onChange: function (e) { setFilter(e.target.value); } }),
          h("div", { className: "dp-pickList" }, groupsEl.length ? groupsEl : h("p", { className: "dp-empty" }, "没有匹配的会话")),
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel }, "取消"),
            h("button", { type: "button", className: "dp-btnPrimary", disabled: chosen.length === 0 || props.busy, onClick: function () { props.onSubmit(chosen); } }, props.busy ? "添加中…" : "添加所选 (" + chosen.length + ")"))
        )
      );
    }

    function ProjectPickerModal(props) {
      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, "把会话加入项目"),
          h("div", { className: "dp-pickList" },
            props.projects.length === 0
              ? h("p", { className: "dp-empty" }, "还没有项目")
              : props.projects.map(function (p) {
                return h("div", {
                  key: p.id, className: "dp-pickRow",
                  onClick: function () { props.onSubmit(p.id); },
                },
                  h("span", { className: "dp-pickLabel" }, p.name),
                  h("span", { className: "dp-pickMeta" }, p.folders.length + " 目录 · " + p.sessionIds.length + " 会话"));
              })),
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel }, "取消"))));
    }

    // ── multi-folder new-session modal ────────────────────────────────────
    function NewSessionModal(props) {
      var project = props.project;
      var foldersState = react.useState(project.folders || []);
      var checkedState = react.useState(null); // null → default: all checked
      var addingState = react.useState(false);
      var busyState = react.useState(false);
      var errState = react.useState(null);
      var folders = foldersState[0];
      var setFolders = foldersState[1];
      var checkedOverride = checkedState[0];
      var setCheckedOverride = checkedState[1];
      var adding = addingState[0];
      var setAdding = addingState[1];
      var busy = busyState[0];
      var setBusy = busyState[1];
      var err = errState[0];
      var setErr = errState[1];

      var checked = {};
      folders.forEach(function (f) {
        checked[f.path] = checkedOverride === null ? true : checkedOverride[f.path] === true;
      });
      function toggle(path) {
        setCheckedOverride(function (prev) {
          var base = prev === null ? checked : prev;
          var n = {};
          for (var k in base) n[k] = base[k];
          n[path] = !base[path];
          return n;
        });
      }
      var chosen = folders.filter(function (f) { return checked[f.path]; });
      var primary = chosen[0];

      function addFolder() {
        setAdding(true);
        setErr(null);
        props.workspaces.pickDirectory().then(function (path) {
          if (path == null) {
            setAdding(false);
            return;
          }
          return props.workspaces.create({ path: path }).then(function (ws) {
            return props.api.addFolder(project.id, { path: ws.path, workspaceId: ws.workspaceId });
          }).then(function (updated) {
            setFolders((updated && updated.folders) || []);
            setAdding(false);
          });
        }).catch(function (e) {
          setAdding(false);
          setErr(String((e && e.message) || e));
        });
      }

      function submit() {
        if (primary === undefined) {
          setErr("请至少勾选一个文件夹");
          return;
        }
        setBusy(true);
        setErr(null);
        var createPromise;
        if (primary.workspaceId) {
          createPromise = Promise.resolve(props.workspaces.connectWorkspace(primary.workspaceId)).then(extractSessionId);
        } else {
          createPromise = Promise.resolve(props.sessions.create({ cwd: primary.path })).then(extractSessionId);
        }
        createPromise.then(function (sessionId) {
          if (sessionId === undefined) throw new Error("会话创建失败");
          return props.api.attachSession(project.id, sessionId).then(function () {
            return sessionId;
          });
        }).then(function (sessionId) {
          setBusy(false);
          props.sessions.open(sessionId);
          props.onDone(sessionId);
        }).catch(function (e) {
          setBusy(false);
          setErr(String((e && e.message) || e));
        });
      }

      return h("div", { className: "dp-backdrop", onClick: function (e) { if (e.target === e.currentTarget && !busy) props.onCancel(); } },
        h("div", { className: "dp-modal" },
          h("h3", { className: "dp-modalTitle" }, "在项目「" + project.name + "」新建会话"),
          h("div", { className: "dp-field" },
            h("span", { className: "dp-label" }, "勾选本会话涉及的文件夹（可多选）"),
            folders.length === 0 ? h("span", { className: "dp-hint" }, "项目还没有文件夹，先添加一个") : null,
            h("div", { className: "dp-pickList" },
              folders.map(function (f) {
                var isPrimary = primary !== undefined && primary.path === f.path;
                return h("label", { key: f.path, className: "dp-pickRow" },
                  h("input", { type: "checkbox", className: "dp-pickCheck", checked: !!checked[f.path], onChange: function (e) { toggle(f.path); } }),
                  h("span", { className: "dp-pickLabel", title: f.path }, (isPrimary ? "主 " : "") + folderLabel(f.path) + "  " + f.path),
                  isPrimary ? h("span", { className: "dp-pickMeta" }, "会话工作目录") : null);
              }),
              h("div", { className: "dp-pickRow" },
                h("button", { type: "button", className: "dp-btn", onClick: addFolder, disabled: adding || busy }, adding ? "选择中…" : "＋ 添加文件夹")))),
          primary !== undefined ? h("p", { className: "psv-cwdHint" }, "会话工作目录：" + primary.path + "；其余勾选的文件夹同属项目，会话可跨文件夹读取。") : null,
          err ? h("p", { className: "dp-error" }, err) : null,
          h("div", { className: "dp-modalFooter" },
            h("button", { type: "button", className: "dp-btn", onClick: props.onCancel, disabled: busy }, "取消"),
            h("button", { type: "button", className: "dp-btnPrimary", onClick: submit, disabled: busy || primary === undefined }, busy ? "创建中…" : "创建会话"))
        )
      );
    }

    // ── sidebar: project-grouped session list with row-level operations ───
    function SessionListView(props) {
      var api = props.api;
      var sessions = props.sessions;
      var workspaces = props.workspaces;

      var projectsState = react.useState([]);
      var sessionSnapState = react.useState({ byId: {}, current: undefined, ids: [] });
      var collapsedState = react.useState(loadCollapsed());
      var modalState = react.useState(null);
      var menuState = react.useState(null);
      var errState = react.useState(null);
      var projects = projectsState[0];
      var setProjects = projectsState[1];
      var sessionSnap = sessionSnapState[0];
      var collapsed = collapsedState[0];
      var setCollapsed = collapsedState[1];
      var modal = modalState[0];
      var setModal = modalState[1];
      var menu = menuState[0];
      var setMenu = menuState[1];
      var err = errState[0];
      var setErr = errState[1];

      react.useEffect(function () {
        function sync() {
          var s = sessions.list.getSnapshot();
          sessionSnapState[1]({ byId: s.byId || {}, current: s.current, ids: s.ids || [] });
        }
        sync();
        return sessions.list.subscribe(sync);
      }, [sessions]);

      var refresh = react.useCallback(function () {
        api.list().then(function (list) {
          setProjects(list);
          setErr(null);
        }, function (e) {
          setErr(String((e && e.message) || e));
        });
      }, [api]);

      react.useEffect(function () {
        refresh();
      }, [refresh]);

      function toggleCollapse(id) {
        setCollapsed(function (prev) {
          var n = {};
          for (var k in prev) n[k] = prev[k];
          n[id] = !n[id];
          saveCollapsed(n);
          return n;
        });
      }

      function runAction(promise) {
        promise.then(function () {
          refresh();
        }, function (e) {
          setErr(String((e && e.message) || e));
          refresh();
        });
      }

      function addFolderTo(project) {
        workspaces.pickDirectory().then(function (path) {
          if (path == null) return;
          return workspaces.create({ path: path }).then(function (ws) {
            return api.addFolder(project.id, { path: ws.path, workspaceId: ws.workspaceId });
          }).then(function () {
            refresh();
          });
        }).catch(function (e) {
          setErr(String((e && e.message) || e));
        });
      }

      function openText(project, field, title, hint) {
        api.detail(project.id).then(function (d) {
          setModal({ type: "text", id: project.id, field: field, title: title, hint: hint, value: d[field] || "" });
        }, function (e) {
          setErr(String((e && e.message) || e));
        });
      }

      // ── menus ──
      function projectMenu(project, x, y) {
        setMenu({
          x: x, y: y, items: [
            { label: "新建会话…（可多选文件夹）", onClick: function () { setModal({ type: "newSession", projectId: project.id }); } },
            { label: "添加文件夹…", onClick: function () { addFolderTo(project); } },
            { label: "添加会话到项目…", onClick: function () { setModal({ type: "sessionPicker", id: project.id }); } },
            { sep: true },
            { label: "重命名…", onClick: function () { setModal({ type: "edit", id: project.id, name: project.name, description: project.description }); } },
            { label: "项目指令（AGENTS.md）…", onClick: function () { openText(project, "instructions", "项目指令（AGENTS.md）", "项目级规则，注入本项目每个会话的系统提示。"); } },
            { label: "项目记忆（PROJECT.md）…", onClick: function () { openText(project, "memory", "项目共享记忆（PROJECT.md）", "本项目所有会话共享的记忆，会话开始时整体注入。"); } },
            { sep: true },
            { label: project.archived ? "还原项目" : "归档项目", onClick: function () { runAction(api.archive(project.id, !project.archived)); } },
            { label: "删除项目", danger: true, onClick: function () { if (window.confirm("删除项目「" + project.name + "」？\n文件夹、会话与记录都会保留，仅移除分组与项目记忆目录。")) runAction(api.remove(project.id)); } },
          ],
        });
      }

      function sessionMenu(projectIdOrNull, sid, x, y) {
        var items = [{ label: "打开会话", onClick: function () { sessions.open(sid); } }];
        if (projectIdOrNull !== null) {
          items.push({ label: "移出项目", onClick: function () { runAction(api.detachSession(projectIdOrNull, sid)); } });
        } else {
          items.push({ label: "加入项目…", onClick: function () { setModal({ type: "projectPicker", sessionId: sid }); } });
        }
        setMenu({ x: x, y: y, items: items });
      }

      // ── rows ──
      var activeProjects = projects.filter(function (p) { return !p.archived; });
      var archivedProjects = projects.filter(function (p) { return p.archived; });
      var projectSessionIds = {};

      function renderSessionRow(sid, projectIdOrNull) {
        var summary = sessionSnap.byId[sid];
        var isCurrent = sessionSnap.current === sid;
        var ghost = summary === undefined;
        if (!ghost && summary.origin === "subagent") return null;
        return h("div", {
          key: sid, className: "psv-row",
          "data-current": isCurrent ? "" : null,
          "data-ghost": ghost ? "" : null,
          title: ghost ? sid : sessionLabel(summary),
          onClick: function () { sessions.open(sid); },
          onContextMenu: function (e) { e.preventDefault(); sessionMenu(projectIdOrNull, sid, e.clientX, e.clientY); },
        },
          h("span", { className: "psv-dot" }),
          h("span", { className: "psv-label" }, ghost ? ghostLabel(sid) : sessionLabel(summary)));
      }

      var body = [];

      activeProjects.forEach(function (project) {
        (project.sessionIds || []).forEach(function (sid) { projectSessionIds[sid] = true; });
        var isOpen = !collapsed[project.id];
        var rows = (project.sessionIds || []).map(function (sid) { return renderSessionRow(sid, project.id); }).filter(function (r) { return r !== null; });
        body.push(h("div", { key: project.id, className: "psv-group" },
          h("div", {
            className: "psv-groupHead",
            title: "右键或 ⋯ 操作",
            onClick: function (e) { if (e.target.closest(".psv-act") === null) toggleCollapse(project.id); },
            onContextMenu: function (e) { e.preventDefault(); projectMenu(project, e.clientX, e.clientY); },
          },
            h("span", { className: "psv-chev" }, isOpen ? "▾" : "▸"),
            h("span", { className: "psv-gName" }, project.name),
            h("span", { className: "psv-gCount" }, (project.sessionIds || []).length + " 会话"),
            h("button", { type: "button", className: "psv-act", title: "新建会话（可多选文件夹）", onClick: function (e) { e.stopPropagation(); setModal({ type: "newSession", projectId: project.id }); } }, "＋"),
            h("button", { type: "button", className: "psv-act", title: "更多操作（也可右键）", onClick: function (e) { e.stopPropagation(); var r = e.currentTarget.getBoundingClientRect(); projectMenu(project, r.left, r.bottom + 2); } }, "⋯")),
          isOpen ? h("div", { className: "psv-sessions" }, rows) : null));
      });

      var ungroupedIds = (sessionSnap.ids || []).filter(function (sid) {
        if (projectSessionIds[sid] === true) return false;
        var summary = sessionSnap.byId[sid];
        return summary !== undefined && summary.origin !== "subagent";
      });
      if (ungroupedIds.length > 0) {
        body.push(h("div", { key: "ungrouped", className: "psv-group" },
          h("div", { className: "psv-groupHead", onClick: function () { toggleCollapse("__ungrouped"); } },
            h("span", { className: "psv-chev" }, !collapsed.__ungrouped ? "▾" : "▸"),
            h("span", { className: "psv-gName" }, "未分组"),
            h("span", { className: "psv-gCount" }, ungroupedIds.length + " 会话")),
          !collapsed.__ungrouped ? h("div", { className: "psv-sessions" }, ungroupedIds.map(function (sid) { return renderSessionRow(sid, null); })) : null));
      }

      if (archivedProjects.length > 0) {
        var archOpen = !collapsed.__archived;
        body.push(h("div", { key: "archived", className: "psv-group" },
          h("div", { className: "psv-groupHead psv-archHead", onClick: function () { toggleCollapse("__archived"); } },
            h("span", { className: "psv-chev" }, archOpen ? "▾" : "▸"),
            h("span", { className: "psv-gName" }, "已归档"),
            h("span", { className: "psv-gCount" }, archivedProjects.length + " 项目")),
          archOpen ? h("div", { className: "psv-sessions" },
            archivedProjects.map(function (p) {
              return h("div", {
                key: p.id, className: "psv-row", "data-ghost": "",
                title: "右键或点击操作",
                onClick: function (e) { var r = e.currentTarget.getBoundingClientRect(); projectMenu(p, r.left, r.bottom + 2); },
                onContextMenu: function (e) { e.preventDefault(); projectMenu(p, e.clientX, e.clientY); },
              },
                h("span", { className: "psv-dot" }),
                h("span", { className: "psv-label" }, p.name));
            })) : null));
      }

      if (activeProjects.length === 0 && ungroupedIds.length === 0) {
        body.push(h("p", { key: "empty", className: "psv-empty" }, "还没有项目——点上方「＋ 新建项目」，把多个文件夹和会话收纳成一组。"));
      }

      // ── modals ──
      var modalEl = null;
      if (modal !== null && modal.type === "create") {
        modalEl = h(CreateModal, {
          workspaces: workspaces,
          onSubmit: function (payload, done) {
            api.create(payload).then(function (project) {
              done();
              setModal(null);
              setCollapsed(function (prev) {
                var n = {};
                for (var k in prev) n[k] = prev[k];
                delete n[project.id];
                saveCollapsed(n);
                return n;
              });
              refresh();
            }, function (e) {
              done();
              setErr(String((e && e.message) || e));
            });
          },
          onCancel: function () { setModal(null); },
        });
      } else if (modal !== null && modal.type === "newSession") {
        var nsProject = projects.find(function (p) { return p.id === modal.projectId; });
        if (nsProject !== undefined) {
          modalEl = h(NewSessionModal, {
            project: nsProject,
            api: api,
            sessions: sessions,
            workspaces: workspaces,
            onDone: function () { setModal(null); refresh(); },
            onCancel: function () { setModal(null); },
          });
        }
      } else if (modal !== null && modal.type === "edit") {
        modalEl = h(EditModal, {
          name: modal.name,
          description: modal.description,
          busy: false,
          onSubmit: function (payload) {
            setModal(null);
            runAction(api.update(modal.id, payload));
          },
          onCancel: function () { setModal(null); },
        });
      } else if (modal !== null && modal.type === "text") {
        modalEl = h(TextModal, {
          title: modal.title,
          hint: modal.hint,
          value: modal.value,
          busy: false,
          onSubmit: function (value) {
            setModal(null);
            if (modal.field === "instructions") runAction(api.update(modal.id, { instructions: value }));
            else runAction(api.writeMemory(modal.id, value));
          },
          onCancel: function () { setModal(null); },
        });
      } else if (modal !== null && modal.type === "sessionPicker") {
        var pickerProject = projects.find(function (p) { return p.id === modal.id; });
        if (pickerProject !== undefined) {
          modalEl = h(SessionPickerModal, {
            sessionSnap: sessionSnap,
            projects: projects,
            projectName: pickerProject.name,
            projectSessionIds: pickerProject.sessionIds,
            busy: false,
            onSubmit: function (chosen) {
              setModal(null);
              runAction(Promise.all(chosen.map(function (sid) { return api.attachSession(pickerProject.id, sid); })));
            },
            onCancel: function () { setModal(null); },
          });
        }
      } else if (modal !== null && modal.type === "projectPicker") {
        modalEl = h(ProjectPickerModal, {
          projects: projects.filter(function (p) { return !p.archived; }),
          onSubmit: function (projectId) {
            var sid = modal.sessionId;
            setModal(null);
            runAction(api.attachSession(projectId, sid));
          },
          onCancel: function () { setModal(null); },
        });
      }

      return h("div", { "data-dsh-easy-projects-list": true },
        h("div", { className: "psv-head" },
          h("span", { className: "psv-headLabel" }, "项目"),
          h("button", { type: "button", className: "psv-headBtn", onClick: function () { setModal({ type: "create" }); } }, "＋ 新建项目")),
        h("div", { className: "psv-body" },
          err ? h("p", { className: "dp-error" }, err) : null,
          body,
          modalEl),
        menu !== null ? h(ContextMenu, { x: menu.x, y: menu.y, items: menu.items, onClose: function () { setMenu(null); } }) : null);
    }

    // ── plugin ─────────────────────────────────────────────────────────────
    var inject = ["sessions", "workspaces"];

    function apply(ctx) {
      if (typeof window !== "undefined" && window.__dshEasyProjectApplied__) return;
      if (typeof window !== "undefined") window.__dshEasyProjectApplied__ = true;

      var api = new Api();
      var disposers = [];
      try {
        disposers.push(mountSessionList(api, ctx.sessions, ctx.workspaces));
      } catch (e) {
        console.warn("[dsh-easy-project] mount failed:", e);
      }
      ctx.effect(function () {
        return function () {
          for (var i = 0; i < disposers.length; i++) disposers[i]();
        };
      }, "dsh-easy-project: ui mounts");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
