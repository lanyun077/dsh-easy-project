# dsh-easy-project

给 DeepSeek Harness（dsh）补上「项目」概念的插件：**侧栏会话按项目分组；一个项目可挂多个文件夹；新建会话时可同时勾选多个文件夹；同一份项目记忆和指令在所有会话间共享。** 不改 dsh 内核，纯插件实现。

## 它解决什么问题

dsh 原生的侧栏会话列表按「工作区」（= 单个文件夹）分组，一旦你的工作跨多个目录就不够用了：

- 想把 `backend/`、`frontend/`、`docs/` 当**一个项目**一起管理 —— 原生做不到；
- 想开一个会话，同时涉及几个文件夹 —— 原生做不到；
- 前一个会话里定下的约定，新会话一无所知 —— 没有项目级共享记忆。

本插件把这三件事补齐，操作逻辑对齐 Codex 的项目分组体验。

## 功能一览

| 功能 | 说明 |
|---|---|
| 会话按项目分组 | 侧栏直接显示「项目 → 会话」树 + 未分组 + 已归档，点击即开，替代原生单文件夹分组 |
| 多文件夹项目 | 一个项目挂任意多个文件夹（自动注册为工作区） |
| 多文件夹新建会话 | 新建会话时**勾选多个文件夹**：第一个勾选的是会话工作目录，其余文件夹同属项目、可跨文件夹读取，模型通过系统提示全知晓 |
| 行级操作 | 项目行右键/悬停菜单：新建会话、添加文件夹、添加会话、重命名、指令、记忆、归档、删除；会话行右键：打开、移出项目、加入项目 |
| 项目共享记忆 | `PROJECT.md` 在本项目每个会话开始时整体注入，agent 可用 `project_memory_write` 工具续写 |
| 项目指令 | 项目级 `AGENTS.md` 注入本项目所有会话的系统提示 |

## 安装

前置：已装 dsh（`dsh web` 能跑起来），Node ≥ 20。

```sh
dsh plugin --profile web add github:lanyun077/dsh-easy-projcet
```

`dsh plugin add` 会自动把插件行写进 profile；如果需要手动，在你的 profile `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: project
      name: 'dsh-easy-project'
```

然后重启 `dsh web`。

<details>
<summary>手动安装（不走 pnpm）</summary>

把仓库里的 `index.js`、`store.js`、`client.js`、`cordis.patch.yml`、`package.json` 复制到 `<profile>/node_modules/dsh-easy-project/`，再加上面的 patch 行，重启即可。

</details>

## 使用

1. 侧栏顶部点「＋ 新建项目」，多选几个文件夹；
2. 在项目行上**右键**（或悬停 ＋ / ⋯）：新建会话时勾选本次要涉及的文件夹；
3. 旧会话右键「加入项目」收进分组；
4. 所有管理操作都在右键菜单里，没有独立的管理界面。

数据都存在本地：`~/.dsh/projects/<id>/`（`project.json` + `AGENTS.md` + `PROJECT.md`），卸载插件或删除项目都不会动你的文件夹和会话记录。

## 已知限制

- 会话归属项目是**显式**的（在分组视图里创建/加入），不按目录自动推断；
- 侧栏分组视图是 DOM 级接管（dsh 原生侧栏没有对外插件插槽），依赖语义类名匹配；官方 UI 大改版后如失效，更新选择器即可，数据不受影响；
- 多文件夹会话的写权限遵循 dsh 原生沙箱（会话工作目录可写，读跨文件夹不受限）。

## 开发

无构建步骤，三个源文件即全部逻辑：

| 文件 | 职责 |
|---|---|
| `index.js` | 宿主半边：HTTP 路由（`/api/dsh-easy-project/*`）、系统提示注入（项目上下文 + PROJECT.md 快照）、agent 工具 |
| `store.js` | 纯文件 I/O 的项目存储（原子写，无框架依赖） |
| `client.js` | 浏览器半边：侧栏项目分组视图、右键菜单、各类弹窗（ModuleLoader bundle） |

```sh
npm test          # 存储层冒烟测试
```

调试：改完文件复制进 profile 的 node_modules 后重启 `dsh web`（宿主半边）或强刷浏览器（客户端半边）。

## License

[MIT](./LICENSE)
