# Claude Island — TODO

## Bug Fixes (Priority)
- [ ] 跳转偶尔失灵 — 多个同名窗口时 AppActivate 随机匹配，考虑用 ffi-napi 调 Win32 API
- [ ] 点击没反应/需点1-2次 — 透明窗口 setIgnoreMouseEvents 吞事件，考虑换不透明方案
- [ ] 卡顿感 — IPC 来回 + PowerShell 启动开销，考虑精简通信链路
- [ ] 多 Agent 时 source 混乱 — 环境变量检测不可靠

## Features (Next)
- [ ] 内联审批 — 直接在灵动岛点 Yes/No 完成审批，不用跳转
- [ ] 音效提示 — 任务完成/需要审批时播放提示音
- [ ] Token 用量显示 — 显示当前额度消耗
- [ ] 多 Agent 支持 — Codex、Gemini CLI、Cursor Agent（监控终端输出方式）
- [ ] 多会话 Tabs — 同时追踪多个 Claude Code 会话
- [ ] Markdown 渲染 — 展开状态渲染 Claude 回复内容

## Architecture (Long Term)
- [ ] Tauri 重写 — 替代 Electron，内存 10-20MB（当前 80-150MB）
- [ ] 原生窗口 — 去掉透明窗口方案，解决点击/卡顿问题
- [ ] Mac 支持 — Swift 原生版本，利用刘海/灵动岛区域
- [ ] 开机自启 — Windows 启动项 / Mac Login Items
- [ ] 打包分发 — .exe 安装包 (Windows) / .dmg (Mac)
