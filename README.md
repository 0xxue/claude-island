# Claude Island — Dynamic Island for Claude Code

> iPhone 灵动岛风格的桌面通知，让你不错过 Claude Code 的每一次等待。

## 效果

```
收缩状态（屏幕顶部居中）：
┌──────────────────────────────────────┐
│  🟣 Claude Code · 等待你的操作        │
└──────────────────────────────────────┘

展开状态（点击后）：
┌──────────────────────────────────────────────┐
│  🟣 Claude Code                              │
│                                              │
│  ✏️ 正在等待你审批文件修改                      │
│  📁 src/App.tsx (+15 lines)                  │
│                                              │
│  [ 跳转到 Claude Code ]    [ 忽略 ]           │
└──────────────────────────────────────────────┘
```

## 为什么需要

Claude Code 在 CMD 或 VS Code 里运行时，经常需要等待用户操作（审批文件修改、确认工具调用等）。如果你切到了其他窗口，很容易错过这些提示，导致 Claude 一直等着白白浪费时间。

Claude Island 像 iPhone 灵动岛一样，在屏幕顶部弹出浮窗通知你。

## 核心功能

- **灵动岛浮窗** — 屏幕顶部居中，收缩/展开动画
- **自动检测等待** — Claude Code 原生 Hooks 触发，零侵入
- **一键跳转** — 点击直接切到 Claude Code 所在的终端/VS Code
- **多场景通知** — 等待输入、权限审批、任务完成、错误提醒
- **自动收起** — 用户操作后或超时自动收缩
- **系统托盘** — 后台常驻，右键退出

## 架构

```
Claude Code (CMD / VS Code Terminal)
    │
    │  ~/.claude/settings.json hooks 触发
    │  (Stop / PermissionRequest / Notification)
    ▼
notify-bridge (轻量 CLI 脚本)
    │
    │  WebSocket ws://127.0.0.1:19432
    ▼
Claude Island App (Electron / Tauri)
    │
    │  无边框透明置顶窗口
    ▼
屏幕顶部灵动岛浮窗 → 用户点击 → 跳转到 Claude Code
```

### 为什么需要 bridge？

Claude Code Hooks 每次触发都 spawn 一个新进程。如果直接启动 GUI 太重。bridge 是一个轻量 CLI，只做一件事：发个 WebSocket 消息给已经运行的灵动岛 app，然后退出。

## 检测机制 — Claude Code Hooks

Claude Code 原生支持 Hooks 系统（settings.json），提供以下事件：

| 事件 | 触发时机 | 灵动岛行为 |
|------|----------|-----------|
| `Stop` | Claude 写完一轮，等待用户下一步操作 | 弹出"等待你的操作" |
| `PermissionRequest` | Claude 需要审批工具调用（文件修改等） | 弹出"请审批：修改 xxx 文件" |
| `Notification` | Claude 发送通知 | 弹出通知内容 |
| `SessionStart` | 新会话开始 | 灵动岛显示"会话进行中" |
| `SessionEnd` | 会话结束 | 灵动岛收起 |

### Hook 配置（~/.claude/settings.json）

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-island/bridge.js --event stop"
      }]
    }],
    "PermissionRequest": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-island/bridge.js --event permission --tool \"$HOOK_TOOL_NAME\""
      }]
    }],
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-island/bridge.js --event notification --message \"$HOOK_MESSAGE\""
      }]
    }]
  }
}
```

### Hook 环境变量

每个 hook 都会收到这些环境变量：

| 变量 | 说明 |
|------|------|
| `session_id` | 当前会话 ID |
| `transcript_path` | 对话记录文件路径 |
| `cwd` | Claude Code 工作目录 |
| `permission_mode` | 权限模式 |

## 技术选型

### MVP 阶段：Electron

| 项 | 选择 |
|----|------|
| 框架 | Electron |
| 窗口 | frameless + transparent + alwaysOnTop + skipTaskbar |
| IPC | WebSocket (ws://127.0.0.1:19432) |
| Bridge | Node.js 单文件脚本 |
| 动画 | CSS transitions + JS |
| 窗口跳转 | Windows: PowerShell AppActivate / Mac: AppleScript |
| 内存 | ~80-150MB |

### 正式版：Tauri (可选升级)

| 项 | 选择 |
|----|------|
| 框架 | Tauri (Rust + WebView) |
| 内存 | ~10-20MB |
| 窗口跳转 | Rust winapi crate (Windows) / objc crate (Mac) |
| 分发 | .msi (Windows) / .dmg (Mac) |

## 项目结构

```
claude-island/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js            # 预加载脚本
│   ├── island/
│   │   ├── index.html        # 灵动岛 UI
│   │   ├── styles.css        # 动画样式
│   │   └── app.js            # 前端逻辑
│   ├── ws-server.js          # WebSocket 服务端
│   ├── window-focus.js       # 窗口跳转逻辑
│   └── tray.js               # 系统托盘
├── bridge/
│   └── bridge.js             # Hook 桥接 CLI
├── install/
│   └── setup-hooks.js        # 自动配置 Claude Code hooks
├── assets/
│   └── icon.png              # 托盘图标
├── package.json
└── README.md
```

## 灵动岛 UI 设计

### 收缩状态

```css
/* 胶囊形状 */
width: 280px;
height: 36px;
border-radius: 20px;
background: rgba(15, 23, 42, 0.9);
backdrop-filter: blur(20px);
/* 屏幕顶部居中 */
position: fixed;
top: 8px;
left: 50%;
transform: translateX(-50%);
```

### 展开状态

```css
/* 展开 */
width: 360px;
height: auto; /* ~140px */
border-radius: 28px;
padding: 16px;
/* 弹簧动画 */
transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 动画列表

| 动画 | 效果 | 时机 |
|------|------|------|
| 弹入 | 从顶部滑入 + 缩放 | 收到通知时 |
| 展开 | 宽度+高度+圆角过渡 | 点击时 |
| 收缩 | 反向过渡 | 再次点击或超时 |
| 脉冲 | 紫色光晕呼吸 | 等待中持续 |
| 消失 | 向上滑出 + 缩小 | 用户操作后 |
| 图标旋转 | loading 图标 | 处理中 |

### 配色

```
背景：rgba(15, 23, 42, 0.92)  — 深色毛玻璃
主色：#8B5CF6 (紫)
成功：#22C55E (绿)
警告：#F59E0B (橙)
文字：#F8FAFC (白)
次文字：#94A3B8 (灰)
```

## 通知类型

### 1. 等待操作（Stop 事件）

```
┌─ 🟣 ── Claude Code · 等待你的输入 ─────┐
└─────────────────────────────────────────┘
```

### 2. 权限审批（PermissionRequest 事件）

```
┌─ 🟡 ── Claude Code · 需要审批 ─────────┐
│                                         │
│  📝 Edit: src/App.tsx                   │
│     +15 lines / -3 lines               │
│                                         │
│  [ 跳转审批 ]              [ 忽略 ]      │
└─────────────────────────────────────────┘
```

### 3. 任务完成（Notification 事件）

```
┌─ 🟢 ── Claude Code · 任务完成 ─────────┐
└─────────────────────────────────────────┘
```

### 4. 错误（Notification + error 类型）

```
┌─ 🔴 ── Claude Code · 出错了 ───────────┐
└─────────────────────────────────────────┘
```

## 窗口跳转实现

### Windows

```javascript
// 方案 1: PowerShell AppActivate
exec('powershell -c "(New-Object -ComObject WScript.Shell).AppActivate(\'Claude\')"');

// 方案 2: 通过 PID 查找窗口 (更精确)
// 读取 ~/.claude/sessions/{pid}.json 获取 PID
// 用 Win32 EnumWindows + SetForegroundWindow
```

### macOS

```javascript
// AppleScript
exec('osascript -e \'tell application "Terminal" to activate\'');
```

## 安装 & 使用

### 一键安装

```bash
# 克隆项目
git clone https://github.com/0xxue/claude-island.git
cd claude-island
npm install

# 自动配置 Claude Code hooks
node install/setup-hooks.js

# 启动灵动岛
npm start
```

### 手动配置

如果自动安装失败，手动编辑 `~/.claude/settings.json` 添加 hooks 配置。

### 开机自启

```bash
# Windows: 添加到启动文件夹
npm run install-startup

# Mac: 添加到 Login Items
npm run install-startup
```

## 开发计划

### Phase 1: MVP (1-2 天)

- [ ] Electron 无边框透明窗口
- [ ] WebSocket 服务端
- [ ] Bridge CLI 脚本
- [ ] Hook 自动配置
- [ ] 基础收缩/展开动画
- [ ] Stop + PermissionRequest 通知
- [ ] 点击跳转窗口

### Phase 2: 完善 (2-3 天)

- [ ] 弹簧动画优化
- [ ] 多种通知类型 UI
- [ ] 系统托盘 + 右键菜单
- [ ] 自动收起策略
- [ ] 多会话支持
- [ ] 声音提示（可选）

### Phase 3: 分发 (1 天)

- [ ] 打包 .exe (Windows) / .dmg (Mac)
- [ ] 开机自启配置
- [ ] GitHub Release
- [ ] README 截图/GIF

### Phase 4: Tauri 重写 (可选)

- [ ] Rust 后端替换 Node.js
- [ ] 内存降至 10-20MB
- [ ] 原生窗口跳转

## 许可

MIT

---

灵感来源：iPhone Dynamic Island
