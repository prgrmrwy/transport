# Transport

内网高速文件传输工具，支持 Windows / macOS / Android 三端互通。

在家庭或办公内网中，通过浏览器或原生应用在设备间传输大文件、视频等内容。

## 技术栈

- **前端**: React 19 + TypeScript + TailwindCSS 4 + Zustand + React Router 7
- **后端**: Rust + axum（HTTP 服务 + 文件操作 + 流式传输）
- **跨平台**: Tauri 2（Windows / macOS / Android 原生应用）
- **浏览器模式**: 无需安装客户端，任何设备通过浏览器访问即可使用

## 功能

- 文件浏览（目录导航、面包屑路径）
- 文件上传（multipart 流式，支持拖拽）
- 文件下载（流式传输，512KB 分块）
- 文件操作（新建文件夹、重命名、删除）
- 设备发现（局域网设备列表）
- 带宽限速（可调节传输速度上限）
- PC / 移动端 / VR 自适应布局（UA 自动检测）
- 前端日志上报（pino -> axum 日志文件）

## 快速开始

### 环境要求

- Node.js 18+
- pnpm
- Rust toolchain（会自动安装）

### 开发

```bash
# 安装依赖（首次会自动安装 Rust）
pnpm bootstrap

# 启动开发服务（axum 后端 + Vite 前端）
pnpm dev
```

启动后：
- 前端开发服务: http://localhost:1420
- API 服务: http://localhost:8090
- 局域网其他设备访问: http://<本机IP>:1420

### 构建

```bash
# 构建前端 + 后端
pnpm build

# 构建 Tauri 原生应用
pnpm tauri build
```

## 项目结构

```
transport/
├── src/                    # React 前端
│   ├── components/         # 通用组件（FileBrowser, DeviceList, Layout...）
│   ├── pages/              # 页面组件（HomePage, Mobile*Page, SettingsPage）
│   ├── services/           # API 调用层（localApi, remoteApi）
│   ├── stores/             # Zustand 状态管理
│   ├── lib/                # 工具库（logger, useIsMobile, env）
│   └── types.ts            # TypeScript 类型定义
├── src-tauri/              # Rust 后端 + Tauri 配置
│   ├── src/server/         # axum HTTP 服务（路由、处理器、落地页）
│   ├── src/transfer/       # 传输模块（限速器）
│   └── assets/             # 静态资源（落地页 HTML）
├── vite.config.ts          # Vite 配置（代理、HMR、base路径）
└── docs/plans/             # 设计文档和实施计划
```

## 多端访问

| 平台 | 访问方式 | 布局 |
|------|----------|------|
| PC 浏览器 | http://IP:1420 或 :8090/app/ | 侧边栏 + 文件浏览器 |
| 手机浏览器 | 同上 | 底部 Tab（设备/文件/设置） |
| VR 浏览器 | 同上 | PC 布局，下载用 window.open |
| 原生应用 | Tauri 桌面 / Android APK | 同浏览器布局 |

## 调试

开发模式自动启用页面内 Debug Console。生产环境在 URL 末尾加 `#debug` 开启。

## License

MIT
