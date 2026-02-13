# Transport - 内网文件传输应用设计文档

## 概述

Transport 是一个家庭内网高速文件传输与文件管理应用，支持 Win11 / macOS / Android 三端，一套代码运行。用户安装后可在局域网内自动发现设备，浏览对方文件系统并进行完整的文件操作。

## 技术选型

| 技术 | 用途 |
|------|------|
| Tauri 2 | 跨平台框架（桌面 + Android） |
| React 18 + TypeScript | 前端 UI |
| Vite | 构建工具 |
| TailwindCSS | 样式 |
| Zustand | 状态管理 |
| axum | Rust HTTP 服务器 |
| tokio | Rust 异步运行时 |
| mdns-sd | mDNS 设备发现 |
| serde / serde_json | 数据序列化 |

### Tauri 插件

- tauri-plugin-fs：文件系统访问
- tauri-plugin-dialog：文件选择对话框
- tauri-plugin-notification：传输完成通知

## 架构

### P2P 模式

每台设备同时是客户端和服务端：

- Rust 后端启动 axum HTTP 服务，暴露文件操作 API
- 通过 mDNS 广播自身存在并发现局域网内其他设备
- React 前端通过 Tauri IPC 操作本机，通过 HTTP 调用远程设备
- 文件传输走 HTTP 流式传输

```
设备 A                              设备 B
┌──────────────┐    HTTP      ┌──────────────┐
│ React UI     │◄──────────►  │ React UI     │
│ Tauri Rust   │  (局域网)    │ Tauri Rust   │
│ - axum 服务  │              │ - axum 服务  │
│ - mDNS 发现  │              │ - mDNS 发现  │
│ - 文件操作   │              │ - 文件操作   │
└──────────────┘              └──────────────┘
```

### 设备间 HTTP API

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | /api/files?path=... | 浏览文件列表 |
| GET | /api/files/download?path=... | 下载文件（流式） |
| POST | /api/files/upload | 上传文件（multipart 流式） |
| DELETE | /api/files?path=... | 删除文件 |
| PUT | /api/files/rename | 重命名 |
| POST | /api/files/mkdir | 新建文件夹 |
| GET | /api/device/info | 获取设备信息 |

### 应用分发页

每台设备的 HTTP 服务同时提供一个应用分发落地页：

| 路径 | 用途 |
|------|------|
| / | 落地页，自动检测 User-Agent 推荐对应平台安装包 |
| /download/windows | 下载 Windows 安装包 |
| /download/macos | 下载 macOS 安装包 |
| /download/android | 下载 Android APK |

安装包存放于本地目录 `~/.transport/installers/`，落地页只展示实际存在的安装包。

## 带宽控制

使用令牌桶（Token Bucket）限速器，应用在流式读写层：

- 默认限制在链路带宽的 80%
- 用户可在设置页面自定义限速值
- 支持"不限速"模式

## UI 设计

### 页面结构

三个页面：

1. **首页**：左侧设备列表 + 右侧文件浏览器
2. **文件浏览器**：路径导航 + 文件列表 + 操作工具栏
3. **设置页**：共享目录、带宽限速、设备名

### 布局

```
┌─────────────────────────────────────────────┐
│  顶部栏: 应用名 + 本机设备名 + 设置按钮       │
├──────────┬──────────────────────────────────┤
│ 设备列表  │         文件浏览器                │
│ (侧边栏) │  路径导航: / > home > user        │
│          │  文件/文件夹列表                   │
│          │  支持多选、右键菜单                 │
├──────────┴──────────────────────────────────┤
│  底部: 传输队列 (进度/速度/状态)               │
└─────────────────────────────────────────────┘
```

### 传输队列

- 显示传输方向、文件名、大小、进度条、速度
- 支持暂停/取消单个任务
- 可折叠

### 文件操作交互

- 下载：选中文件 → 工具栏/右键 → 选择本地保存路径 → 加入队列
- 上传：工具栏按钮或拖拽文件 → 加入队列
- 删除：右键菜单，删除前弹确认框
- 重命名/新建文件夹：右键菜单
- 多选：Ctrl/Shift 多选批量操作

## 浏览器模式

除了 Tauri 原生应用，所有功能同时支持通过浏览器访问。任何设备（包括 iOS、智能电视等无法安装原生应用的设备）只要有浏览器，即可访问完整 UI。

### 架构

axum HTTP 服务在提供 REST API 的同时，额外 serve 打包后的 React SPA 静态资源：

```
axum HTTP 服务器
├── /                       ← 落地页（应用分发 + "在浏览器中使用" 入口）
├── /app                    ← React SPA 静态资源（浏览器模式完整 UI）
├── /app/assets/*           ← JS/CSS 等静态文件
├── /api/...                ← REST API（Tauri 和浏览器共用）
└── /download/:platform     ← 安装包下载
```

### 环境检测与适配

React 前端通过 `'__TAURI__' in window` 检测运行环境，在两种模式下行为有差异：

| 能力 | Tauri 原生 | 浏览器模式 |
|------|-----------|-----------|
| 文件浏览/管理 | HTTP API | 同样走 HTTP API，无差异 |
| 文件下载 | Tauri dialog 选路径 | 浏览器标准 `<a download>` |
| 文件上传 | 拖拽 / dialog | `<input type="file">` / 拖拽，无差异 |
| 设备发现 | mDNS 自动发现 | 不可用，仅显示当前连接的设备 |
| 限速设置 | Tauri IPC | 走 HTTP API `/api/settings/throttle` |
| 传输通知 | 系统原生通知 | 浏览器 Notification API |

### localApi 适配策略

`services/localApi.ts` 中统一处理环境差异：

```
Tauri 模式:  invoke("get_devices")         → mDNS 结果
浏览器模式:  fetch("/api/device/info")      → 仅当前设备

Tauri 模式:  invoke("set_throttle_rate")   → Tauri IPC
浏览器模式:  fetch("/api/settings/throttle") → HTTP API
```

### 额外收益

- iOS 设备通过 Safari 访问完整功能
- 智能电视、游戏机等任何有浏览器的设备可用
- 临时用户无需安装，浏览器直接使用
- 落地页无缝衔接：分发页 → "在浏览器中使用" 按钮

## 安全

- 无需验证，局域网内直接信任
- MVP 阶段不做断点续传

## 项目目录结构

```
transport/
├── src/                          # React 前端
│   ├── components/
│   │   ├── DeviceList.tsx        # 设备列表侧边栏
│   │   ├── FileBrowser.tsx       # 文件浏览器
│   │   ├── FileItem.tsx          # 文件/文件夹行
│   │   ├── PathNav.tsx           # 路径导航
│   │   ├── TransferQueue.tsx     # 传输队列面板
│   │   └── Toolbar.tsx           # 文件操作工具栏
│   ├── pages/
│   │   ├── HomePage.tsx          # 首页
│   │   └── SettingsPage.tsx      # 设置页
│   ├── stores/
│   │   ├── deviceStore.ts        # 设备列表状态
│   │   └── transferStore.ts      # 传输队列状态
│   ├── services/
│   │   ├── localApi.ts           # Tauri IPC 调用
│   │   └── remoteApi.ts          # 远程设备 HTTP 调用
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── server/
│   │   │   ├── mod.rs            # axum 服务启动
│   │   │   ├── routes.rs         # API 路由
│   │   │   ├── handlers.rs       # 请求处理
│   │   │   └── landing.rs        # 分发落地页
│   │   ├── discovery/
│   │   │   └── mod.rs            # mDNS 发现
│   │   ├── transfer/
│   │   │   ├── mod.rs            # 传输管理
│   │   │   └── throttle.rs       # 限速器
│   │   └── commands.rs           # Tauri IPC 命令
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── assets/
│       └── landing.html          # 分发页 HTML
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── docs/
    └── plans/
```
