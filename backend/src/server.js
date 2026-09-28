/**
 * 3X-UI 一键搭建平台 - 后端入口
 * 提供静态前端托管 + WebSocket 实时安装通道
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { attachWs } = require('./wsHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: 'ok', data: { time: Date.now() } });
});

// 托管前端构建产物（若已 build）
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(200).send('后端已启动。前端尚未构建，请运行 npm run build。');
  });
});

const server = http.createServer(app);
attachWs(server);

server.listen(PORT, () => {
  console.log('3X-UI 部署平台后端已启动: http://localhost:' + PORT);
  console.log('WebSocket 端点: ws://localhost:' + PORT + '/ws');
});
