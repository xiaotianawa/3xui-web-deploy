# 3X-UI 一键搭建平台

一个把官方 3X-UI 交互式安装脚本，变成“填表 + 一键 + 全程可视化”的 Web 平台。

## 功能特性

- 前端表单填写服务器 IP、SSH 端口、用户名、密码或私钥
- 支持“测试连接”与“一键搭建”两个核心按钮
- 安装过程通过 WebSocket 实时回传到终端风格日志框
- 用户名、密码、面板端口、Web 路径均由后端随机生成
- 安装完成后展示面板地址、用户名、密码等结果，支持复制
- 全程无 emoji，图标统一使用语义匹配的 SVG

## 目录结构

```
3xui-deploy/
├── backend/                 后端（Node.js + Express + ssh2 + ws）
│   ├── package.json
│   ├── scripts/
│   │   └── install.sh       官方 3X-UI
│   └── src/
│       ├── server.js        入口，静态托管 + WebSocket
│       ├── wsHandler.js     WebSocket 消息处理
│       ├── install.js       安装编排（连接/上传/执行/读结果）
│       ├── ssh.js           SSH 连接与命令执行
│       └── random.js        随机参数生成
├── frontend/                前端（Vue3 + Vite + Element Plus）
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── style.css
│       ├── views/DeployView.vue
│       ├── components/
│       │   ├── ConnectForm.vue    连接表单
│       │   ├── TerminalLog.vue    日志终端
│       │   └── ResultCard.vue     结果卡片
│       └── utils/ws.js            WebSocket 封装
└── README.md
```

## 环境要求

- Node.js >= 18（推荐 20 或更高）
- 一台可 ssh 登录的 Linux 服务器（目标机，用于安装 3X-UI）
- 后端运行环境需能访问目标服务器的 SSH 端口

## 安装与启动

### 1. 启动后端

```bash
cd backend
npm install
npm start
```

默认监听 3000 端口，可用环境变量修改：

```bash
PORT=8080 npm start
```

### 2. 启动前端（开发模式）

```bash
cd frontend
npm install
npm run dev
```

开发模式默认 5173 端口，已在 vite.config.js 中把 /ws 代理到后端 3000。

### 3. 生产构建

```bash
cd frontend
npm run build
```

构建产物位于 frontend/dist，后端会自动托管该目录：

```bash
cd ../backend
npm start
# 浏览器访问 http://<后端主机>:3000
```

## 使用步骤

1. 打开平台页面
2. 填写：服务器地址、SSH 端口（默认 22）、登录用户名（默认 root）、密码或私钥
3. 先点“测试连接”，确认能连上
4. 点“一键搭建”，右侧日志框会实时显示安装过程
5. 安装完成后，右侧显示面板地址、随机用户名与密码，复制保存

## 工作原理

官方脚本支持非交互模式。后端在 ssh 执行脚本前，注入以下环境变量：

| 环境变量 | 含义 |
|---|---|
| XUI_NONINTERACTIVE | 设为 1，启用非交互模式 |
| XUI_USERNAME | 随机用户名 |
| XUI_PASSWORD | 随机密码 |
| XUI_PANEL_PORT | 随机面板端口 |
| XUI_WEB_BASE_PATH | 随机 Web 访问路径 |

脚本执行完成后，会在目标服务器生成 /etc/x-ui/install-result.env，
后端读取并解析该文件，得到最终的访问地址、账号密码与 API Token。

## 安全说明

- 服务器密码与私钥仅在内存中使用，不会写入数据库或日志
- 生产环境建议通过 HTTPS/WSS 访问，避免凭据明文传输
- 后端已对 SSH 命令做了参数化处理，避免命令注入
- 请勿把平台部署到公网而不加访问控制

## 常见问题

- 连接超时：检查服务器 IP、SSH 端口、防火墙是否放行
- 认证失败：确认用户名、密码或私钥是否正确
- 非 root 用户：后端会尝试 sudo，若失败请改用 root 账户
- 安装失败：查看日志框中的具体报错，常见原因是系统发行版不受支持或端口被占用