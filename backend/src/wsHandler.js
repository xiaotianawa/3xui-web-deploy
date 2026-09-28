/**
 * WebSocket 处理器
 * 负责与前端建立实时双向通信：
 *  C -> S : { type: 'test' | 'start' | 'ping', payload: {连接信息} }
 *  S -> C : { type: 'log' | 'status' | 'testResult' | 'result' | 'error' }
 */
const { WebSocketServer } = require('ws');
const install = require('./install');

function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  let currentTask = null;

  wss.on('connection', (ws, req) => {
    const peer = (req && req.socket && req.socket.remoteAddress) || 'unknown';
    console.log('[ws] client connected from ' + peer);
    safeSend(ws, { type: 'hello', data: { message: 'WebSocket 已连接' } });

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch (e) {
        safeSend(ws, { type: 'error', data: { message: '消息格式错误' } });
        return;
      }
      const { type, payload } = msg || {};
      console.log('[ws] recv type=' + type + ' from ' + peer);

      if (type === 'ping') {
        safeSend(ws, { type: 'pong', data: { time: Date.now() } });
        return;
      }

      if (type === 'test') {
        const opts = normalize(payload);
        if (!opts.host || !opts.username) {
          safeSend(ws, { type: 'error', data: { message: '请填写服务器地址与用户名' } });
          safeSend(ws, { type: 'testResult', data: { ok: false, message: '请填写服务器地址与用户名' } });
          return;
        }
        safeSend(ws, { type: 'status', data: { phase: 'testing', message: '正在测试连接...' } });
        console.log('[test] start -> ' + opts.username + '@' + opts.host + ':' + opts.port);
        try {
          const r = await install.testConnection(opts);
          console.log('[test] result ok=' + r.ok + ' msg=' + (r.message || ''));
          safeSend(ws, { type: 'testResult', data: r });
          safeSend(ws, { type: 'status', data: { phase: r.ok ? 'idle' : 'testFailed', message: r.ok ? '连接正常，可以开始搭建' : r.message } });
        } catch (e) {
          console.log('[test] exception: ' + e.message);
          safeSend(ws, { type: 'testResult', data: { ok: false, message: install.friendlyError(e) } });
          safeSend(ws, { type: 'status', data: { phase: 'testFailed', message: install.friendlyError(e) } });
        }
        return;
      }

      if (type === 'start') {
        if (currentTask) {
          safeSend(ws, { type: 'error', data: { message: '已有安装任务正在进行，请稍后再试' } });
          return;
        }
        const opts = normalize(payload);
        if (!opts.host || !opts.username) {
          safeSend(ws, { type: 'error', data: { message: '请填写服务器地址与用户名' } });
          return;
        }
        console.log('[start] install -> ' + opts.username + '@' + opts.host + ':' + opts.port);
        const emit = (evt) => safeSend(ws, evt);
        currentTask = install.runInstall(opts, emit);
        try {
          await currentTask;
        } catch (e) {
          console.log('[start] error: ' + e.message);
        } finally {
          currentTask = null;
        }
        return;
      }

      safeSend(ws, { type: 'error', data: { message: '未知指令: ' + type } });
    });

    ws.on('close', () => console.log('[ws] client disconnected ' + peer));
    ws.on('error', (e) => console.log('[ws] socket error: ' + e.message));
  });

  return wss;
}

function safeSend(ws, obj) {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch (e) {
    console.log('[ws] send fail: ' + e.message);
  }
}

function normalize(p) {
  p = p || {};
  return {
    host: String(p.host || '').trim(),
    port: parseInt(p.port, 10) || 22,
    username: String(p.username || 'root').trim(),
    password: p.password ? String(p.password) : undefined,
    privateKey: p.privateKey ? String(p.privateKey) : undefined,
    passphrase: p.passphrase ? String(p.passphrase) : undefined,
    timeoutMs: 12000
  };
}

module.exports = { attachWs };
