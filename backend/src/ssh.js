/**
 * SSH 连接与命令执行模块
 * 基于 ssh2 实现：支持密码认证与私钥认证，
 * 支持流式回传命令输出（用于实时日志）。
 */
const { Client } = require('ssh2');

/**
 * 创建一个 SSH 连接
 * @param {Object} opts 连接参数
 * @param {string} opts.host 主机
 * @param {number} opts.port SSH 端口
 * @param {string} opts.username 用户名
 * @param {string} [opts.password] 密码
 * @param {string} [opts.privateKey] 私钥内容
 * @param {string} [opts.passphrase] 私钥口令
 * @returns {Promise<Client>}
 */
function connect(opts) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const timeoutMs = opts.timeoutMs || 12000;
    const startedAt = Date.now();

    console.log('[ssh] connecting ' + opts.username + '@' + opts.host + ':' + (opts.port || 22) + ' timeout=' + timeoutMs + 'ms');

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { conn.end(); } catch (e) {}
        console.log('[ssh] TIMEOUT after ' + (Date.now() - startedAt) + 'ms -> ' + opts.host);
        reject(new Error('连接超时，请检查服务器地址、SSH 端口或网络是否可达'));
      }
    }, timeoutMs);

    conn.on('ready', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.log('[ssh] ready in ' + (Date.now() - startedAt) + 'ms -> ' + opts.host);
      resolve(conn);
    });

    conn.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.log('[ssh] ERROR in ' + (Date.now() - startedAt) + 'ms -> ' + opts.host + ' : ' + err.message);
      reject(err);
    });

    const cfg = {
      host: opts.host,
      port: opts.port || 22,
      username: opts.username || 'root',
      readyTimeout: timeoutMs,
      keepaliveInterval: 10000
    };

    if (opts.privateKey) {
      cfg.privateKey = opts.privateKey;
      if (opts.passphrase) cfg.passphrase = opts.passphrase;
    } else {
      cfg.password = opts.password;
    }

    try {
      conn.connect(cfg);
    } catch (e) {
      if (!settled) { settled = true; clearTimeout(timer); reject(e); }
    }
  });
}

/**
 * 执行命令并流式回传输出
 * @param {Client} conn SSH 连接
 * @param {string} command 命令
 * @param {(type:string, data:string)=>void} onData 输出回调 type: stdout|stderr|close
 * @returns {Promise<number>} 退出码
 */
function exec(conn, command, onData) {
  return new Promise((resolve, reject) => {
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let exitCode = null;
      stream.on('close', (code) => {
        exitCode = code;
        if (onData) onData('close', '');
      });
      stream.on('data', (d) => { if (onData) onData('stdout', d.toString('utf8')); });
      stream.stderr.on('data', (d) => { if (onData) onData('stderr', d.toString('utf8')); });
      stream.on('end', () => { resolve(exitCode === null ? 0 : exitCode); });
    });
  });
}

/**
 * 执行命令并收集完整输出（不流式）
 * 带超时，避免卡死
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function execCollect(conn, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = timeoutMs || 15000;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('命令执行超时: ' + command.slice(0, 60)));
    }, t);

    conn.exec(command, (err, stream) => {
      if (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        return reject(err);
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => { stdout += d.toString('utf8'); });
      stream.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
      stream.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ code: code === null ? 0 : code, stdout, stderr });
      });
    });
  });
}

module.exports = { connect, exec, execCollect };
