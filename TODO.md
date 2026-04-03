# Claude Island — TODO

## 已知问题（第一版遗留）
> 部分问题在 Tauri 重写时自然解决，标记为 [Tauri]；其余需要在当前版本修复

- [ ] Electron 透明窗口卡顿 — 高频 IPC + 透明渲染掉帧 [Tauri]
- [ ] 点击吞事件 — `-webkit-app-region: drag` 导致需点 1-2 次，pill 状态设置/声音按钮不可点 [已部分修复]
- [ ] Jump 跳转不准 — 来源识别正确但跳转目标错误；取消操作后跳反；多窗口偶尔失灵
- [ ] 拖动卡顿 — 快速拖动跟不上鼠标
- [ ] 新通知时窗口自动偏移 + 三击恢复位置不准
- [ ] 宠物像素泄漏 — pill 状态右上角露出多余宠物
- [ ] 设置弹窗定位 — 受 overflow:hidden 裁剪，没跟随按钮位置 [已部分修复]
- [ ] Windows DPI 175% 缩放 — 窗口尺寸异常，最小窗口限制 ~202x38

## Phase 1: UI 定稿 ✅
- [x] 确定最终 UI 风格（Demo 4 毛玻璃）
- [x] 宠物系统（6种像素宠物，CSS box-shadow 精灵图，状态联动）
- [x] 三态切换（圆点透明悬浮 → 胶囊状态栏 → 展开通知面板）
- [x] 多 Agent 通知卡片（Claude/Codex/Gemini/Cursor 专属像素图标）
- [x] 内联审批按钮（Deny / Allow Once / Allow All / Bypass）
- [x] 代码 diff 预览、音效系统、设置弹窗、拖拽、Jump 按钮
- [x] 4套主题统一功能（毛玻璃/暗黑/黑金/终端）

## Phase 1.5: 代码整合 ⬅️ 当前第一步
> 4 套 demo 还是独立 HTML，src/island/ 是早期简化版。先把 demo4 的完整功能迁移到主程序，后续开发才有统一基础。

### 1.5.1 迁移 demo4 → src/island/
- [ ] 宠物系统（pet.js + pixel-pets.css）接入 Electron 前端
- [ ] 音效系统（sound.js）接入
- [ ] 设置弹窗（宠物选择 + 声音开关）
- [ ] 多 Agent 通知卡片渲染（目前只有单条状态文字）
- [ ] diff 预览 + 审批按钮（Deny / Allow Once / Allow All / Bypass）
- [ ] 通知列表滚动 + "Show all sessions" 入口

### 1.5.2 清理
- [ ] 确认 demo1-4 不再作为开发目标，仅保留做参考
- [ ] 接入 `detect-source.ps1` / `get-active-title.ps1`（已写未用）
- [ ] `src/tray.js` 实现或删除

### 1.5.3 配置持久化
- [ ] 读取 / 保存 `island.config.json`（主题、宠物、音效、窗口位置）
- [ ] 首次启动生成默认配置
- [ ] 设置弹窗修改 → 写入配置文件

## Phase 2: 多 Agent 核心
> 核心卖点：一个面板同时监控多个 AI Agent + 精准跳转到对应终端
>
> **依赖顺序**：2.1 → 2.2/2.3（可并行）→ 2.4 → 2.6 → 2.5 → 2.7 → 2.8 → 2.9 → 2.10

### 技术调研结论（2026-04 确认）

**Hook 兼容性：**
| Agent | Hook 支持 | 配置文件 | 输入方式 | 双向通信（审批） | session_id |
|-------|----------|----------|---------|-----------------|------------|
| Claude Code | ✅ 完整 | `~/.claude/settings.json` | stdin JSON | ✅ stdout JSON | ✅ env + stdin |
| Codex CLI | ✅ 完整（克隆 Claude 格式） | `~/.codex/hooks.json` | stdin JSON | ✅ stdout JSON（exit 2 = block） | ✅ stdin |
| Gemini CLI | ✅ 超集（11 种事件） | `~/.gemini/settings.json` | stdin JSON | ✅ stdout JSON（exit 2+ = block） | ✅ stdin |
| Cursor | ❌ 无 hook API | N/A（闭源 VS Code fork） | N/A | ❌ | ❌ |
| Windsurf | ❌ 无 hook API | N/A（闭源 VS Code fork） | N/A | ❌ | ❌ |
| Aider | ❌ 无原生 hook | N/A | N/A | ❌ | ❌ |

**关键发现：**
- Codex CLI 内部引擎叫 `ClaudeHooksEngine`，JSON schema 与 Claude Code 一模一样，零适配
- Gemini CLI 自带 `gemini hooks migrate --from-claude` 迁移命令
- Gemini 比 Claude 多出 BeforeModel / AfterModel / BeforeToolSelection 事件
- 三者的 stdin JSON 都包含 session_id、tool_name、tool_input，bridge 几乎不用改结构
- **内联审批在 Phase 2 就能做**（三者都支持 hook stdout 返回 allow/deny 决策）

**Codex CLI stdin 格式示例：**
```json
{
  "session_id": "uuid",
  "turn_id": "string",
  "transcript_path": "/path",
  "cwd": "/project",
  "hook_event_name": "PreToolUse",
  "model": "o4-mini",
  "permission_mode": "default",
  "tool_name": "Bash",
  "tool_input": { "command": "cargo fmt" },
  "tool_use_id": "call-id"
}
```

**Gemini CLI 事件名映射：**
| Claude Code | Gemini CLI |
|---|---|
| PreToolUse | BeforeTool |
| PostToolUse | AfterTool |
| UserPromptSubmit | BeforeAgent |
| Stop | AfterAgent |
| SessionStart | SessionStart |
| SessionEnd | SessionEnd |
| PreCompact | PreCompress |
| Notification | Notification |

**Gemini 工具名映射：** Edit→replace, Bash→run_shell_command, Read→read_file, Write→write_file, Glob→glob, Grep→grep, LS→ls

### Cursor / Windsurf / Aider 接入方案（待测试）
> 这三个没有原生 hook，需要探索替代方案。记录备选方案，到时逐一测试可行性。

**方案 A: VS Code Extension（推荐优先测试）**
- Cursor 和 Windsurf 都是 VS Code fork，理论上能装 VS Code 扩展
- 扩展通过 VS Code API 监听文件变更（onDidSaveTextDocument）、终端命令（onDidWriteTerminalData）
- 扩展内部发 WebSocket 给 island
- ⚠️ 限制：只能感知文件/终端层面的变化，看不到 Agent 内部的工具调用意图
- ⚠️ 限制：无法做内联审批（Agent 工具调用不经过扩展）
- 结果：**降级体验** — 能显示「Agent 在工作」「改了哪些文件」，但没有工具级通知

**方案 B: MCP Server 中转**
- Cursor/Windsurf 都支持 MCP，做一个 `island-mcp-server`
- 注册自定义工具，当 Agent 调用 MCP 工具时 island 收到事件
- ⚠️ 限制：MCP 是新增工具，不是拦截已有工具。内置的文件编辑/终端执行不经过 MCP
- ⚠️ 限制：需要用户手动配置 MCP，侵入性较高
- 适合场景：Agent 使用自定义 MCP 工具时能感知

**方案 C: 日志/Trace 文件监听**
- Cursor 有 `CURSOR_TRACE_DIR` 环境变量
- Windsurf 可能有类似的日志目录
- 用 chokidar/fswatch 监听文件变化，解析日志内容
- ⚠️ 限制：日志格式无文档，可能随版本变化，信息可能不完整

**方案 D: API Proxy（技术可行但脆弱）**
- 本地起代理拦截 Agent 发给 LLM 的 API 请求
- 从 request/response 的 tool_use 字段提取工具调用信息
- ⚠️ 限制：需要改 Agent 的 API endpoint 配置，闭源 Agent API 格式可能随版本变
- 好处：理论上能拿到最完整的信息（和 hook 方案同级）

**方案 E: 进程树监控**
- 定时扫描 Cursor/Windsurf 的子进程活动
- 检测 shell 子进程、文件操作等
- ⚠️ 限制：信息量最少，只知道「有活动」，不知道具体工具/意图

**Aider 专项方案：**
- 方案 A: `aider --message` 脚本模式 + stdout 解析
- 方案 B: AiderDesk 第三方 GUI 的 hook 事件转发
- 方案 C: Aider 的 `--event-log` 参数（如果有）→ 文件监听

**测试计划：** 每个方案实际装一遍，验证能拿到什么信息，记录结果后决定最终方案

### 2.1 统一事件协议（IslandEvent）⟵ 最先做
- [ ] 定义 IslandEvent JSON Schema:
  ```
  { agent, terminal, sessionId, pid, event, tool, data, timestamp }
  ```
- [ ] agent 字段: "claude" | "codex" | "gemini" | "cursor" | "windsurf" | "aider"
- [ ] terminal 字段: { type, id/pid } — 标识运行环境
- [ ] event 字段: "tool_start" | "tool_done" | "permission" | "stop" | "error" | "session_start" | "session_end"
- [ ] bridge 统一从 stdin JSON 读取 session_id（当前从 env 读，Codex/Gemini 在 stdin 里）
- [ ] 标准化工具名映射 — Gemini 的 replace/run_shell_command → 统一内部名 Edit/Bash

### 2.2 Bridge 终端检测 ⟵ 与 2.3 并行
> bridge.js 启动时自动嗅探环境变量，识别终端类型

**MVP（常用终端，先做）：**
- [ ] Windows Terminal — `WT_SESSION` (session GUID)
- [ ] VS Code Terminal — `VSCODE_PID` (宿主 PID)
- [ ] Cursor Terminal — `VSCODE_PID` + cursor 进程名判断
- [ ] PowerShell / pwsh — `PSModulePath` 存在，区分 PS5 vs PS7 看进程名
- [ ] CMD — `PROMPT` 存在，无其他终端标记
- [ ] Git Bash — `MSYSTEM=MINGW64`
- [ ] tmux — `TMUX` 存在（叠加检测，tmux 内还能识别宿主终端）
- [ ] 兜底 — `process.ppid` 向上追溯父进程

**后续补充：**
- [ ] WSL — `WSL_DISTRO_NAME`
- [ ] iTerm2 — `ITERM_SESSION_ID`
- [ ] Kitty — `KITTY_PID`
- [ ] Alacritty — `ALACRITTY_WINDOW_ID`
- [ ] WezTerm — `WEZTERM_PANE`
- [ ] Ghostty — `GHOSTTY_RESOURCES_DIR`
- [ ] Warp — `WARP_IS_LOCAL_SHELL_SESSION`
- [ ] macOS Terminal.app — `TERM_PROGRAM=Apple_Terminal`
- [ ] Hyper — `TERM_PROGRAM=Hyper`

### 2.3 Bridge Agent 检测 ⟵ 与 2.2 并行
> 每个 Agent 的 hook 调用 bridge 时，自动识别来源

**Hook Agent（完整体验）：**
- [ ] Claude Code — `--agent claude`（hook 配置写死）+ 已实现
- [ ] Codex CLI — `--agent codex`，hook 格式与 Claude 相同
  - 配置: `~/.codex/hooks.json`，事件: PreToolUse/PostToolUse/SessionStart/Stop/UserPromptSubmit
  - stdin: `{ session_id, turn_id, hook_event_name, tool_name, tool_input, ... }`
- [ ] Gemini CLI — `--agent gemini`
  - 配置: `~/.gemini/settings.json`，事件: BeforeTool/AfterTool/SessionStart/SessionEnd/BeforeAgent/AfterAgent + 3 个独有事件
  - stdin: `{ session_id, hook_event_name, tool_name, tool_input, timestamp, ... }`
  - 工具名需要映射（replace→Edit, run_shell_command→Bash 等）

**非 Hook Agent（降级体验，待测试确定方案）：**
- [ ] Cursor — 优先测试 VS Code Extension 方案
- [ ] Windsurf — 优先测试 VS Code Extension 方案
- [ ] Aider — 优先测试 stdout 解析 / event-log 方案

### 2.4 setup-hooks.js 自动配置
> 一键安装，自动检测已安装的 Agent 并写入各自的 hook 配置

- [ ] 检测 `claude` 命令 → 写 `~/.claude/settings.json`（已实现）
- [ ] 检测 `codex` 命令 → 写 `~/.codex/hooks.json`（格式与 Claude 相同）
- [ ] 检测 `gemini` 命令 → 写 `~/.gemini/settings.json`（事件名映射为 Gemini 格式）
- [ ] 幂等安装 — 重复执行不会覆盖用户已有 hook
- [ ] 卸载命令 — `setup-hooks --uninstall` 清理所有 hook
- [ ] 安装报告 — 输出检测到了哪些 Agent、写入了哪些配置

### 2.5 会话管理
- [ ] activeSessions Map<sessionId, { agent, terminal, pid, state, startTime }>
- [ ] SessionStart 事件 → 注册新会话
- [ ] SessionEnd 事件 → 清理会话
- [ ] 心跳超时 — 60s 无消息标记为 disconnected
- [ ] 每个 session 独立状态追踪（idle/working/waiting/error）

### 2.6 WebSocket 通信
- [ ] ws-server 多连接支持 — 每个 bridge 实例独立连接
- [ ] 消息路由 — 按 sessionId 分发到 UI
- [ ] 双向通信 — 支持 island → bridge 回传审批决策（permission 事件）
- [ ] bridge 模式切分：普通事件 fire-and-forget，permission 事件 request-response（等 UI 回复后 stdout 输出）
- [ ] permission 超时处理 — hook 有 timeout 限制（默认 5s），UI 未响应时返回默认值

### 2.7 多 Agent UI
- [ ] Pill — 显示 "3 Pending · Claude, Codex" 格式
- [ ] Agent 筛选 tab — 展开面板顶部 [All] [Claude] [Codex] [Gemini]
- [ ] 通知卡片 Agent 徽标 + 颜色区分（已有基础）
- [ ] 每个 Agent 独立 Jump → 根据 terminal.type 选择激活方式
- [ ] 每个 session 绑定宠物形象

### 2.8 Jump 精准跳转
> 根据 terminal.type 选择不同的窗口激活策略

- [ ] Windows Terminal — `WT_SESSION` → 找到窗口句柄 → SetForegroundWindow
- [ ] VS Code — `VSCODE_PID` → 找 "Visual Studio Code" 窗口 → 激活
- [ ] Cursor — 找 "Cursor" 窗口 → 激活
- [ ] CMD/PowerShell — 父进程 PID → EnumWindows 匹配 → 激活
- [ ] Git Bash — mintty 进程 → 窗口句柄
- [ ] WSL — wsl.exe 宿主窗口
- [ ] Mac 终端 — AppleScript `tell application "iTerm2" to activate`
- [ ] tmux — `tmux select-window -t <session>:<window>`
- [ ] 通用兜底 — 窗口标题模糊匹配

### 2.9 内联审批（双向通信）
> 三个 Hook Agent 都支持 stdout 返回决策，可以在 Phase 2 实现，不用等 Tauri

- [ ] bridge permission 模式 — 收到 permission 事件后不立即退出，保持 WS 连接等待回复
- [ ] island UI → WebSocket → bridge → stdout JSON 回传链路
- [ ] Claude Code 审批格式: `{ "decision": "allow" | "deny", "reason": "..." }`
- [ ] Codex 审批格式: `{ "hookSpecificOutput": { "permissionDecision": "allow" | "deny" } }`
- [ ] Gemini 审批格式: `{ "decision": "approve" | "deny" | "block", "reason": "..." }`
- [ ] 超时兜底 — hook timeout 前 500ms 自动返回默认值（allow），避免 Agent 卡死
- [ ] island 未运行时 — bridge 直接退出（等同于不拦截，Agent 走自己的审批流程）

### 2.10 测试与验证
> 多 Agent 场景不容易手动测，需要模拟方案

- [ ] mock-agent.js — 命令行工具，模拟任意 Agent 发送事件流
  - `node mock-agent.js --agent codex --events tool_start,tool_done,permission,stop`
- [ ] 多 session 并发测试 — 同时跑 3 个 mock agent
- [ ] 内联审批端到端测试 — 模拟 permission 事件 → UI 点击 → 验证 stdout 输出
- [ ] 各终端环境变量验证脚本
- [ ] Cursor/Windsurf 备选方案逐一测试 — 记录每个方案能拿到什么信息

## Phase 3: 主题 & 自定义
### 3.1 主题切换
- [ ] 合并 4 套 demo 为 CSS 变量方案（Phase 1.5 已迁移 demo4，此处补充其余 3 套主题变量）
- [ ] 设置弹窗内主题选择器
- [ ] 主题 CSS 热加载（切换无需刷新）
- [ ] 自定义主题（用户 JSON → CSS 变量映射）

### 3.2 自定义宠物
- [ ] 支持导入 PNG/GIF 自定义宠物
- [ ] 宠物动画帧配置（idle/working/alert）
- [ ] 社区宠物分享（未来）

### 3.3 自定义音效
- [ ] 支持 .wav/.mp3 自定义音效
- [ ] 每个事件类型独立配置
- [ ] 音量/音调调节

## Phase 4: Tauri 重写
> 解决 Electron 的根本性问题：卡顿、透明窗口性能、点击穿透、包体积
> 注意：内联审批已提前到 Phase 2.9 实现，此处迁移到 Rust 实现

- [ ] Rust + WebView2 项目初始化
- [ ] 原生窗口管理（透明/置顶/拖拽）— 解决 Electron 透明窗口卡顿
- [ ] Rust WebSocket server（tokio-tungstenite）
- [ ] Rust Bridge CLI（单二进制编译，替代 node bridge.js）
- [ ] Hook 自动配置（Rust 版 setup-hooks）
- [ ] 前端 UI 迁移（复用 HTML/CSS/JS，改 IPC 调用方式）
- [ ] 系统托盘 + 右键菜单
- [ ] island.config.json 配置系统
- [ ] Win32 API 精准窗口跳转（Rust ffi）— 解决 PowerShell 方案的性能/可靠性问题
- [ ] AskUserQuestion — 面板内直接回复 Agent 提问
- [ ] Cursor/Windsurf VS Code Extension 的 Tauri 端对接

## Phase 5: 打磨 & 分发
- [ ] Token 用量显示
- [ ] Markdown 渲染（Agent 回复预览）
- [ ] 开机自启 + 自动更新
- [ ] 打包 .msi / .dmg / .AppImage
- [ ] 产品官网 + GitHub README + Demo GIF
- [ ] 国际化（中/英）

---

## 配置文件示例（island.config.json）

```json
{
  "agents": {
    "claude": { "enabled": true, "pet": "crab", "color": "#D97757" },
    "codex": { "enabled": true, "pet": "robot", "color": "#3B82F6" },
    "gemini": { "enabled": true, "pet": "dragon", "color": "#22C55E" },
    "cursor": { "enabled": true, "pet": "ghost", "color": "#A78BFA" },
    "windsurf": { "enabled": true, "pet": "fox", "color": "#06B6D4" }
  },
  "pet": {
    "type": "octopus",
    "customImage": null,
    "animations": true
  },
  "sounds": {
    "enabled": true,
    "volume": 0.5,
    "customSounds": {}
  },
  "theme": "glass",
  "notifications": {
    "showToolEvents": true,
    "autoExpandOnPermission": true,
    "autoExpandWhenAway": true
  },
  "window": {
    "rememberPosition": true,
    "defaultPosition": "top-center"
  }
}
```

## Hook 配置示例

### Claude Code (~/.claude/settings.json)
```json
{
  "hooks": {
    "PreToolUse": [{ "command": "island-bridge --agent claude", "timeout": 5000 }],
    "PostToolUse": [{ "command": "island-bridge --agent claude", "timeout": 5000 }],
    "Stop": [{ "command": "island-bridge --agent claude", "timeout": 5000 }]
  }
}
```

### Codex CLI (~/.codex/hooks.json)
```json
{
  "hooks": {
    "PreToolUse": [{ "command": "island-bridge --agent codex", "timeout": 5000 }],
    "PostToolUse": [{ "command": "island-bridge --agent codex", "timeout": 5000 }]
  }
}
```

### Gemini CLI (~/.gemini/settings.json)
```json
{
  "hooks": {
    "BeforeTool": [{ "command": "island-bridge --agent gemini" }],
    "AfterTool": [{ "command": "island-bridge --agent gemini" }],
    "SessionStart": [{ "command": "island-bridge --agent gemini" }],
    "SessionEnd": [{ "command": "island-bridge --agent gemini" }]
  }
}
```
