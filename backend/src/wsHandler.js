/**
 * WebSocket 处理器（多任务并发版）
 * 每条连接 = 一个独立安装通道，互不干扰。
 * 仍保留一个"全局并发上限"防止把机器/目标打爆。
 *
 *  C -> S : { type: 'test' | 'start' | 'ping', payload: {...} }
 *  S -> C : { type: 'log' | 'status' | 'testResult' | 'result' | 'error' }
 */
const { WebSocketServer } = require('ws');
const install = require('./install');

// 全局并发上限：可理解为"同时最多允许几条安装任务在跑"。
// 默认 20；想调大或关闭就设环境变量，例如 MAX_CONCURRENT=50 npm start
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 20);
let runningCount = 0; // 当前正在安装的任务数

function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const peer = (req && req.socket && req.socket.remoteAddress) || 'unknown';
    console.log('[ws] client connected from ' + peer);

    // 关键：每条连接持有自己的任务状态（不再是全局单锁）
    let currentTask = null;

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
        // 只拦截"本连接自身"的重复点击，不再做全局拦截
        if (currentTask) {
          safeSend(ws, { type: 'error', data: { message: '当前连接已有安装任务在进行，请等待完成后再试' } });
          return;
        }
        // 全局并发保护（可按需调大或关闭）
        if (runningCount >= MAX_CONCURRENT) {
          safeSend(ws, { type: 'error', data: { message: '服务器并发安装数已达上限（' + MAX_CONCURRENT + '），请稍后再试' } });
          return;
        }

        const opts = normalize(payload);
        if (!opts.host || !opts.username) {
          safeSend(ws, { type: 'error', data: { message: '请填写服务器地址与用户名' } });
          return;
        }

        console.log('[start] install -> ' + opts.username + '@' + opts.host + ':' + opts.port);
        const emit = (evt) => safeSend(ws, evt);

        runningCount++;
        currentTask = install.runInstall(opts, emit);
        let wdTimer = null;
        try {
          // 硬超时兜底：15 分钟强制结束，杜绝"锁残留 / 永远点不动"
          await Promise.race([
            currentTask,
            new Promise((_, rej) => {
              wdTimer = setTimeout(() => rej(new Error('安装任务超时（15 分钟），已强制结束')), 15 * 60 * 1000);
            })
          ]);
        } catch (e) {
          console.log('[start] error: ' + e.message);
          safeSend(ws, { type: 'status', data: { phase: 'error', message: install.friendlyError(e) } });
        } finally {
          if (wdTimer) { clearTimeout(wdTimer); wdTimer = null; } // 清掉兜底定时器，避免堆积
          currentTask = null;
          runningCount = Math.max(0, runningCount - 1);
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