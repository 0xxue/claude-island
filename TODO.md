# Claude Island — TODO

## Phase 1: UI 定稿
- [ ] 确定最终 UI 风格（Demo 4 毛玻璃基础上调整）
- [ ] 宠物系统设计
  - [ ] 多种宠物可选（螃蟹/章鱼/猫/龙/机器人/幽灵等）
  - [ ] CSS 精灵图 或 Lottie 矢量动画（轻量）
  - [ ] 宠物状态联动（空闲→打瞌睡，编辑→敲键盘，审批→举牌，出错→冒烟，完成→撒花）
  - [ ] 圆点状态 = 宠物独立显示
  - [ ] 胶囊状态 = 宠物 + 状态文字
  - [ ] 展开状态 = 宠物 + 通知卡片
- [ ] 多 Agent 通知卡片设计
- [ ] 内联审批按钮设计（Deny / Allow Once / Allow All / Bypass）
- [ ] 代码 diff 预览样式
- [ ] 交互式问答 UI（AskUserQuestion 选项展示）
- [ ] 三种状态过渡动画打磨

## Phase 2: Tauri 重写
- [ ] 项目初始化（Rust + WebView）
- [ ] 窗口管理（透明/置顶/拖拽）原生实现
- [ ] WebSocket server（Rust 实现，替代 Node ws）
- [ ] Bridge CLI（Rust 编译，替代 Node bridge.js）
- [ ] Hook 自动配置（读写 ~/.claude/settings.json）
- [ ] 前端 UI 迁移（复用 HTML/CSS/JS）
- [ ] 系统托盘
- [ ] 配置文件系统（island.config.json）
  - [ ] 宠物选择 / 自定义宠物图片
  - [ ] 音效开关 / 自定义音效文件
  - [ ] 主题切换（毛玻璃/黑金/终端/自定义）
  - [ ] 通知过滤（哪些事件显示/忽略）
  - [ ] 自动展开策略
  - [ ] 窗口位置记忆

## Phase 3: 核心功能
- [ ] 内联权限审批 — 点击按钮直接回传审批结果给 Claude Code
- [ ] 交互式问答 — AskUserQuestion 选项直接在面板操作
- [ ] 精准窗口跳转 — 用 Win32 API（Rust ffi）替代 PowerShell AppActivate
- [ ] 多 Agent 支持 — Claude Code + Codex + Gemini CLI + Cursor
- [ ] 多会话追踪 — 同时显示多个 Agent 状态，独立通知卡片

## Phase 4: 终端适配
- [ ] Windows Terminal
- [ ] CMD / PowerShell / pwsh
- [ ] VS Code Terminal
- [ ] Git Bash
- [ ] WSL Terminal
- [ ] Warp（Mac）
- [ ] iTerm2（Mac）
- [ ] Ghostty（Mac/Linux）
- [ ] Terminal.app（Mac）
- [ ] Alacritty
- [ ] Kitty
- [ ] Hyper
- [ ] WezTerm
- [ ] tmux 分屏检测

## Phase 5: 打磨 & 分发
- [ ] 音效提示（任务完成/审批请求/宠物互动）
- [ ] Token 用量显示
- [ ] Markdown 渲染（Claude 回复预览）
- [ ] 开机自启
- [ ] 自动更新
- [ ] 打包分发 — .msi (Windows) / .dmg (Mac)
- [ ] 产品官网

## 配置文件示例（island.config.json）

```json
{
  "pet": {
    "type": "octopus",
    "customImage": null,
    "animations": true
  },
  "sounds": {
    "enabled": true,
    "volume": 0.5,
    "onComplete": "default",
    "onPermission": "alert",
    "onError": "error",
    "customSounds": {}
  },
  "theme": "glass",
  "notifications": {
    "showToolEvents": true,
    "showStopEvents": true,
    "autoExpandOnPermission": true,
    "autoExpandWhenAway": true
  },
  "window": {
    "rememberPosition": true,
    "defaultPosition": "top-center"
  }
}
```
