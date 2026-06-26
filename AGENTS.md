# AGENTS.md — 插件开发 & 发布指南

本文件定义 pi 插件从开发到发布的完整规范。所有操作在主仓库（`main` 分支）完成。

---

## 仓库结构

根据插件数量选择一种布局：

### Layout 1: 裸文件（不推荐）

```
my-extension.ts
```

❌ 无 `package.json` 无法追踪版本，无 README 无法提供文档，不支持 `pi install`。仅适合临时实验。

### Layout 2: 简单插件

```
<repo>/
├── README.md              # 自动生成 — 插件列表
├── package.json           # 仓库根配置
├── scripts/
│   ├── update-docs.ts     # 文档生成脚本
│   └── release.sh         # 发布辅助脚本
├── <plugin-name>/
│   ├── index.ts           # 插件源码
│   ├── package.json       # 插件元数据（含独立版本号）
│   └── README.md          # 插件详细文档
└── LICENSE
```

### Layout 3: 分组插件

```
<repo>/
├── README.md
├── package.json
├── scripts/
│   ├── update-docs.ts
│   └── release.sh
├── <category>/
│   └── <plugin-name>/
│       ├── index.ts
│       ├── package.json
│       └── README.md
└── LICENSE
```

---

## 配置说明

### 根 `package.json`

```json
{
  "name": "my-extensions",
  "repository": "git@github.com:USERNAME/REPO.git",
  "installUrl": "https://github.com/USERNAME/REPO.git",
  "pi": {
    "extensions": [
      "plugin-a",
      "category/plugin-b"
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| `repository` | SSH 地址，用于 `git push` |
| `installUrl` | HTTPS 地址，用于 `pi install`（公开只读） |
| `pi.extensions` | 插件目录的相对路径列表 |

### 插件 `package.json`

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  }
}
```

- Provider 类插件需额外声明 `@earendil-works/pi-ai` 为 peerDependency
- `pi.extensions` 指向入口文件（通常 `./index.ts`）

---

## 设计规范

### 命名规范

| 面向 | 风格 | 格式 | 示例 |
|------|------|------|------|
| **Tool**（agent 调用） | `snake_case` | `<prefix>_<verb>` | `gh_pr_create`, `db_query`, `remind_set` |
| **Command**（用户键入） | `kebab-case` | `/<prefix>-<verb>` | `/gh-pr-create`, `/db-query`, `/remind-set` |

- **prefix**：标识来源插件，适中用全称，过长可缩写
- **verb**：单一动词描述动作（`set`、`list`、`cancel`、`create`、`delete`）
- **例外**：非动词但语义自明的 getter 可保留（如 `alarm_now`、`gh_whoami`）

### Tool 设计原则

**1. 单一职责**

一个 tool 只做一件事，禁止用 `action` 枚举合并多种操作：

```typescript
// ❌ 反模式
pi.registerTool({
  name: "myplugin",
  parameters: Type.Object({
    action: Type.StringEnum(["create", "list", "delete"]),
  }),
  async execute(params) {
    switch (params.action) { /* ... */ }
  },
});

// ✅ 正例
pi.registerTool({ name: "myplugin_create", ... });
pi.registerTool({ name: "myplugin_list",   ... });
pi.registerTool({ name: "myplugin_delete", ... });
```

**2. 同类概念分离**

如果一个操作有两种语义不同的输入模式（如相对 vs 绝对），拆为两个 tool：

```typescript
// ✅ 相对模式
myplugin_schedule(delay_seconds=300)

// ✅ 绝对模式
myplugin_schedule_at(timestamp="2026-06-26T14:30:00Z")
```

**3. 参数严格校验**

Tool 面向 agent，应严格校验格式，不依赖宽松的运行时解析：

```typescript
// ✅ 用正则 / 类型约束在入口处校验
const PATTERN = /^\d{4}-\d{2}-\d{2}$/;
if (!PATTERN.test(params.date)) {
  return { content: [{ type: "text", text: "Error: expected YYYY-MM-DD" }] };
}
```

**4. 合并冗余参数**

同一概念不拆成多个参数。用单一字段 + 有区分度的值表达：

```typescript
// ❌ 冗余
retryCount: Type.Optional(Type.Number({ ... })),
noRetry:    Type.Optional(Type.Boolean({ ... })),

// ✅ 统一
retry: Type.Optional(Type.String({
  description: "Number as string, or 'none'. Default: '3'."
})),
```

**5. 跨平台**

不假设 Unix 环境。时间、路径等使用 Node.js 内置 API：

```typescript
// ✅
const now = new Date();
const home = os.homedir();

// ❌
// exec("date")
// process.env.HOME
```

**6. 对称描述**

同类工具（如相对时间 vs 绝对时间）使用对称的 `description` 和 `promptSnippet`，共享句式 + 唯一差异点，让模型注意力自然集中在差异上：

```typescript
// ✅ 对称 — 共享 "Schedule a reminder alarm using..." 句式
alarm_wait: "Schedule a reminder alarm using a relative delay in seconds."
alarm_set:  "Schedule a reminder alarm using an absolute ISO 8601 timestamp."

// promptSnippet 也保持对称
alarm_wait: "Set alarm (relative): alarm_wait(delay=N, ...)"
alarm_set:  "Set alarm (absolute): alarm_set(at='...', ...)"
```

**7. 正面描述优先**

用正面描述说明工具做什么，避免否定句。准确的描述本身就是最好的约束，不需要额外的禁止性提示词：

```typescript
// ❌ 否定句
description: "This is NOT a blocking sleep"

// ✅ 正面描述
description: "When triggered, a message is injected into the conversation"
```

### Command 设计原则

**1. 比 tool 宽松**

Command 面向人类，接受自然表达；tool 面向 agent，要求精确格式：

```bash
# Command（灵活）
/myplugin-schedule in 5m Call mom
/myplugin-schedule at 14:30 Meeting

# Tool（严格）
myplugin_schedule(delay_seconds=300, message="Call mom")
myplugin_schedule_at(timestamp="2026-06-26T14:30:00+08:00", message="Meeting")
```

**2. LLM fallback**

解析失败时将原始输入交给 agent 处理，而非报错退出：

```typescript
const parsed = tryParse(input);
if (!parsed) {
  pi.sendUserMessage(
    `User input: "${input}". Please use the appropriate tool to handle this.`
  );
  return;
}
```

### 消息呈现

**内容优先，元数据次要** — LLM 收到的 `content` 应直接是核心内容，不包装冗余前缀：

```typescript
pi.registerMessageRenderer("my-message-type", (message, _options, theme) => {
  let text =
    theme.fg("customMessageLabel", "HEADER") + "\n" +
    theme.fg("customMessageText", theme.bold(message.content));  // 主行

  // footer: dimmed metadata
  if (message.details?.id) {
    text += "\n" + theme.fg("dim", `#${message.details.id} @ ${message.details.time}`);
  }

  return new Text(text, 1, 0, (s) => theme.bg("customMessageBg", s));
});
```

### 代码分层（lib.ts 模式）

**将纯逻辑与 pi 胶水代码分离** — 提高可测试性和可复用性：

```
tools/<plugin-name>/
├── index.ts        # pi 注册入口（registerTool、registerCommand）
├── lib.ts          # 纯函数、类型、常量（无 pi API 依赖）
├── lib.test.ts     # 单元测试（纯函数无需 mock）
└── README.md
```

**index.ts 只做三件事**：
1. 导入 lib.ts 的纯函数
2. 调用 `pi.registerTool()` / `pi.registerCommand()`
3. 在 execute() 中编排调用链

**lib.ts 包含**：
- 类型定义
- 配置持久化（load/save config）
- 请求封装（apiRequest）
- 解析/校验函数（parseRepo、validateEmail）
- 格式化工具（maskToken、formatDuration）

真实案例：`pi-github/tools/pi-github/lib.ts`（300+ 行纯函数）

### Test 策略

**每个插件都应包含单元测试**，使用 vitest：

```bash
# vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    exclude: ["**/e2e.test.ts", "**/node_modules/**"],
  },
});
```

```bash
npm test              # 所有测试
npx vitest run        # 单次运行
npx vitest            # watch 模式
```

**测试分层**：

| 层级 | 说明 | 示例 |
|------|------|------|
| 纯函数测试 | 测试 lib.ts 中的函数，无外部依赖 | `validateEmail()`、`parseRepo()` |
| 配置测试 | 测试 load/save config | `loadConfig()` 返回默认值 |
| 集成测试 | 真实 API 调用，用 env var 控制 | `describe.skipIf(!token)("...")` |

参考：`pi-github/tools/pi-github/lib.test.ts`（46 个测试）、本模板 `tools/example-plugin/lib.test.ts`（12 个测试）

### 状态管理

需要跨 session 持久化状态时（如 alarm 闹钟列表、config 配置），使用以下模式：

```typescript
// 1. 通过 pi.appendEntry() 写入 session 历史
function persistState() {
  pi.appendEntry(CUSTOM_TYPE, {
    alarms: alarms.map((a) => ({ ...a })),
    nextId,
  });
}

// 2. 通过 session_start / session_tree 事件恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
      // 恢复状态...
    }
  }
});

// 3. session_shutdown 时清理定时器等资源
pi.on("session_shutdown", async () => {
  clearAllTimers();
});
```

参考：`pi-alarm/tools/alarm/index.ts` 中的完整状态管理实现。

### Tool 结果格式（结构化返回）

**❌ 禁止直接返回字符串**：

```typescript
// ❌ 错误 — agent 无法解析
execute() { return "Error: something went wrong"; }
execute() { return "Success: created issue #42"; }
```

**✅ 必须返回结构化对象**：

```typescript
// ✅ 正确
function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: "text", text }],
    details: details ?? {},
  };
}

async execute(_toolCallId, params) {
  // 成功
  return textResult("Issue created: #42 — Fix login bug", {
    number: 42, title: "Fix login bug", url: "..."
  });

  // 错误（返回中也带 content，而非 throw）
  return textResult("Error: invalid repo format", { error: "bad repo" });
}
```

**renderResult 读取 details 来决定 TUI 展示**：

```typescript
renderResult(result, _options, theme) {
  const details = result.details as { error?: string } | undefined;
  if (details?.error) {
    return new Text(theme.fg("error", "Failed"), 0, 0);
  }
  return new Text(theme.fg("success", "Done"), 0, 0);
}
```

### 常用 Theme 颜色参考

```typescript
// 工具调用
renderCall(args, theme) {
  theme.fg("toolTitle", theme.bold("tool_name"))  // 工具名
  theme.fg("accent", args.repo)                    // 参数高亮
  theme.fg("dim", "(optional info)")               // 次要信息
}

// 工具结果
renderResult(result, _opts, theme) {
  theme.fg("success", "OK / Created / Done")       // 成功
  theme.fg("error", "Failed / Error")              // 失败
  theme.fg("warning", "Warning text")              // 警告
  theme.fg("muted", "Compact summary")             // 摘要
}

// 自定义消息
renderer(message, _opts, theme) {
  theme.fg("customMessageLabel", "HEADER")          // 消息标签
  theme.fg("customMessageText", "body text")        // 消息正文
  theme.bg("customMessageBg", "line text")          // 气泡背景
}
```

---

## 开发技巧

### 如何查阅 pi API 文档

pi 的文档位于 npm 包 `@earendil-works/pi-coding-agent` 的安装目录：

```bash
# 找到包的安装位置
find ~/.local/share/pnpm -path "*/pi-coding-agent*/docs" -type d 2>/dev/null

# 关键文档列表：
# docs/extensions.md     — ExtensionAPI 完整参考（registerTool/Command/Provider 等）
# docs/tui.md            — TUI 组件 API（Text, theme, colors）
# docs/themes.md         — 主题定制
# docs/skills.md         — 技能/能力注册
# docs/sdk.md            — SDK 集成
# docs/models.md         — 模型配置
# docs/packages.md       — 包结构和发布
# docs/prompt-templates.md — Prompt 模板
# docs/keybindings.md    — 快捷键
# docs/custom-provider.md — 自定义 Provider
```

**最佳实践**：开发前先通读 `docs/extensions.md` 和 `docs/tui.md`，了解所有可用 API。

### 从真实插件学习

| 仓库 | 学习点 |
|------|--------|
| [pi-alarm](https://github.com/Traveler0014/pi-alarm) | 状态管理、session 生命周期、定时器、LLM fallback、消息渲染 |
| [pi-github](https://github.com/Traveler0014/pi-github) | lib.ts 分层、多实例架构、TUI renderCall/renderResult、vitest 测试、多平台兼容 |
| [pi-providers](https://github.com/Traveler0014/pi-providers) | Provider 注册、compat 设置、模型定义 |

### 开发流程

```bash
# 1. 创建插件目录和文件
mkdir -p tools/my-plugin
cp tools/example-plugin/index.ts tools/my-plugin/index.ts  # 从模板开始

# 2. 开发时用 -e 快速加载测试
pi -e ./tools/my-plugin/index.ts

# 3. 编写 lib.ts + lib.test.ts
npx vitest                    # watch 模式边写边测

# 4. 冒烟测试
pi -ne -e . -p 'list available tools'  # 确认启动不崩溃、工具被识别

# 5. 补全文档
npm run update-docs

# 6. 发布
bash scripts/release.sh tools/my-plugin patch
```

### 调试技巧

- **Tool 不出现**：检查 `description` 是否足够详细（agent 根据 description 决定何时调用）
- **Command 不响应**：检查是否为 kebab-case，前缀是否匹配
- **TUI 显示异常**：检查 `renderResult` 是否正确读取 `result.content[0].text`
- **Provider 模型不可见**：检查 peerDependencies 是否包含 `@earendil-works/pi-ai`，检查 `/login` 是否完成
- **测试跑不起来**：检查 `vitest.config.ts` 中是否 exclude 了正确的文件

---

## 常见陷阱

### ❌ execute() 返回裸字符串

```typescript
// ❌ 错误 — agent 无法解析
execute() { return "OK created"; }

// ✅ 正确
async execute(_toolCallId, params) {
  return {
    content: [{ type: "text", text: "Issue created: #42" }],
    details: { number: 42 },
  };
}
```

### ❌ Command handler 返回字符串

```typescript
// ❌ 错误 — 用户看不到
handler(args, ctx) { return "Hello"; }

// ✅ 正确 — 用 ctx.ui.notify()
handler(args, ctx) {
  ctx.ui.notify("Hello from command!", "info");
}
```

### ❌ 用 action 枚举合并不同操作

```typescript
// ❌ 反模式 — agent 困惑，参数组合复杂
pi.registerTool({
  name: "myplugin",
  parameters: { action: "create" | "list" | "delete" },
  execute(params) { switch (params.action) {...} },
});

// ✅ 拆分为独立 tool
pi.registerTool({ name: "myplugin_create", ... });
pi.registerTool({ name: "myplugin_list",   ... });
pi.registerTool({ name: "myplugin_delete", ... });
```

### ❌ Command 解析失败直接报错

```typescript
// ❌ 死胡同 — 用户不知道下一步做什么
if (!parsed) {
  ctx.ui.notify("Invalid input", "error");
  return;
}

// ✅ LLM fallback — agent 帮你处理
if (!parsed && ctx.isIdle()) {
  pi.sendUserMessage(`User input: "${input}". Please handle this.`);
  return;
}
```

### ❌ 依赖 Unix 环境

```typescript
// ❌ 不可移植
const home = process.env.HOME;
execSync("date");

// ✅ 跨平台
import * as os from "node:os";
const home = os.homedir();
const now = new Date();
```

### ❌ lib.ts 中 import pi API

```typescript
// ❌ lib.ts 不应依赖 pi — 不可单独测试
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ✅ lib.ts 只依赖 Node.js 内置 + 第三方纯函数库
import * as fs from "node:fs";
import * as path from "node:path";
```

---

## 插件 README 结构

每个插件的 `README.md` 必须包含：

1. **一句话描述**（会被根 README 引用）
2. **功能说明** — 插件做什么
3. **适用范围** — 使用场景
4. **设计说明** — 关键设计决策
5. **配置方法** — 环境变量、`/login` 步骤等
6. **使用示例** — 模型选择、命令/Tool 调用示例

Tool 和 Command 应分别列出并标注命名风格：

```markdown
## Tools (agent-facing, snake_case)

### `myplugin_create`
...

## Commands (user-facing, kebab-case)

### `/myplugin-create`
...
```

---

## 发布流程

以下步骤按顺序执行，不可跳过。

### Step 1: 完成编码

- 修改插件源码（`index.ts`）
- 确保 TypeScript 无类型错误
- 同步更新插件目录下的 `README.md`

### Step 2: 冒烟测试

使用 `pi -ne`（non-interactive 模式）加载插件并发送一条简单 prompt 验证：

```bash
pi -ne -e . -p '<prompt>'
```

- `-e .`：从当前仓库根目录加载，pi 自动从根 `package.json` 的 `pi.extensions` 中加载所有插件
- `<prompt>`：一句简单任务，让 agent 触发插件注册的 Tool 即可（不需复杂交互）

示例：

```bash
pi -ne -e . -p 'list available tools'
```

有单元测试的插件同时运行：

```bash
npm test                              # 单元测试全部通过
```

检查项：
- [ ] pi 正常启动，无崩溃
- [ ] agent 正常响应用户，无异常日志
- [ ] 注册的 Tool 被正确识别（可从 model 的 tool list 确认）
- [ ] `npm test` 全部通过（如适用）
- [ ] Provider 类插件：模型列表中可见新模型，`/login` 流程正常

### Step 3: 补全文档

```bash
npm run update-docs
```

脚本通过 TypeScript AST 自动提取 `index.ts` 中的注册信息并更新根 `README.md`。
**不要手动编辑** `## Extensions` 到 `## Installation` 之间的内容。

### Step 4: 更新版本号并打 tag

```bash
bash scripts/release.sh <extension-path> <bump>
```

`<bump>` 可选：`patch` | `minor` | `major` | `x.y.z`

脚本自动执行：
1. 更新插件 `package.json` 中的 `version`
2. 重新生成根 `README.md`
3. `git commit -m "release: <name>@<version>"`
4. `git tag <name>@<version>`
5. `git push && git push --tags`

### Step 5: 验证发布

```bash
git log --oneline -3     # 确认提交
git tag -l               # 确认 tag
pi install <installUrl>  # 确认可安装
```

---

## Tag 命名规范

```
<extension-path>@<semver>
```

`<extension-path>` 即根 `package.json` 中 `pi.extensions` 里声明的相对路径，与 `release.sh` 的第一个参数一致：

- `my-plugin@1.0.0`
- `tools/alarm@0.3.1`

---

## 创建新插件

### 在现有仓库中添加

1. 创建插件目录及 `index.ts`、`package.json`、`README.md`
2. 在根 `package.json` 的 `pi.extensions` 中追加路径
3. 运行 `npm run update-docs`

### 从零创建新仓库

1. 从模板创建仓库（GitHub: Use this template）
2. 修改根 `package.json`：`name`、`repository`、`installUrl`
3. 创建插件目录，编写源码
4. 运行 `npm install && npm run update-docs`

---

## 注意事项

- 插件版本号独立管理，互不影响
- `scripts/update-docs.ts` 依赖 `tsx` 和 `typescript`（devDependencies），运行前需 `npm install`
- 脚本支持递归扫描（最深 2 层），兼容 Layout 2 和 Layout 3
- 插件 README 中的安装命令使用 HTTPS 地址（`installUrl`），不使用 SSH
- 裸 `.ts` 文件（Layout 1）不支持版本管理和 `pi install`，不推荐用于发布
- **首次发布前必须删除示例插件**（`example-provider`、`tools/example-plugin` 等模板目录），确保 `package.json` 的 `pi.extensions` 只包含实际插件路径
- **Tool execute() 绝不能返回裸字符串** — 必须返回 `{ content: [...], details: {...} }`
