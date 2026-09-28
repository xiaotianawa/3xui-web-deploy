/**
 * 安装编排模块
 * 负责：测试连接 -> 生成随机参数 -> 上传官方脚本 -> 非交互执行 -> 读取安装结果
 */
const fs = require('fs');
const path = require('path');
const ssh = require('./ssh');
const { randStr, randLower, randPort } = require('./random');

const LOCAL_SCRIPT = path.join(__dirname, '..', 'scripts', 'install.sh');
const REMOTE_SCRIPT = '/tmp/xui-install.sh';
const RESULT_FILE = '/etc/x-ui/install-result.env';

function buildRandomParams() {
  return {
    XUI_USERNAME: randStr(8),
    XUI_PASSWORD: randStr(16),
    XUI_PANEL_PORT: String(randPort()),
    XUI_WEB_BASE_PATH: randLower(8)
  };
}

function envPrefix(params) {
  let s = '';
  for (const k of Object.keys(params)) {
    const v = String(params[k]).replace(/'/g, "'\\''");
    s += k + "='" + v + "' ";
  }
  return s;
}

function parseResultEnv(text) {
  const out = {};
  if (!text) return out;
  text.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
      v = v.slice(1, -1).replace(/'\\''/g, "'");
    } else if (v.startsWith('$\'') && v.endsWith("'")) {
      v = v.slice(2, -1).replace(/'\\''/g, "'");
    }
    out[k] = v;
  });
  return out;
}

/**
 * 测试 SSH 连接（带整体超时保护）
 * @returns {Promise<{ok:boolean, message:string, info?:string}>}
 */
async function testConnection(opts) {
  let conn = null;
  const overall = new Promise((resolve) => {
    setTimeout(() => resolve({ ok: false, message: '测试超时（15 秒无响应），请检查服务器地址、SSH 端口或网络可达性' }), 15000);
  });

  const work = (async () => {
    try {
      conn = await ssh.connect(Object.assign({}, opts, { timeoutMs: 12000 }));
      const r = await ssh.execCollect(conn, 'echo OK && uname -m', 8000);
      return { ok: true, message: '连接成功', info: r.stdout.trim() };
    } catch (e) {
      return { ok: false, message: friendlyError(e) };
    } finally {
      if (conn) { try { conn.end(); } catch (x) {} }
    }
  })();

  const result = await Promise.race([work, overall]);
  if (!result.ok && conn) { try { conn.end(); } catch (e) {} }
  return result;
}

function friendlyError(e) {
  const msg = (e && e.message) ? e.message : String(e);
  if (/timeout|timed out|ETIMEDOUT|超时/i.test(msg)) return '连接超时：服务器不可达，请检查 IP、SSH 端口或防火墙';
  if (/ECONNREFUSED/i.test(msg)) return '连接被拒绝：SSH 端口可能未开放';
  if (/authentication|auth|permission denied/i.test(msg)) return '认证失败：用户名、密码或私钥不正确';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return '域名解析失败：请检查服务器地址';
  if (/EHOSTUNREACH|ENETUNREACH/i.test(msg)) return '网络不可达：请检查服务器地址是否正确';
  return msg;
}

/**
 * 执行完整安装流程
 */
async function runInstall(opts, emit) {
  let conn = null;
  let params = null;
  try {
    emit({ type: 'status', data: { phase: 'connecting', message: '正在建立 SSH 连接...' } });
    conn = await ssh.connect(opts);
    emit({ type: 'status', data: { phase: 'connected', message: 'SSH 连接成功' } });

    const who = await ssh.execCollect(conn, 'id -u', 8000);
    const uid = who.stdout.trim();
    if (uid !== '0') {
      emit({ type: 'log', data: { stream: 'stderr', text: '当前用户非 root（uid=' + uid + '），将尝试使用 sudo。若失败请改用 root 账户。\n' } });
    }

    params = buildRandomParams();
    emit({ type: 'status', data: { phase: 'params', message: '已生成随机安装参数', params: publicParams(params) } });
    emit({ type: 'log', data: { stream: 'stdout', text: '随机参数：面板端口=' + params.XUI_PANEL_PORT + '，Web 路径=' + params.XUI_WEB_BASE_PATH + '\n' } });

    emit({ type: 'status', data: { phase: 'upload', message: '正在上传安装脚本...' } });
    const scriptContent = fs.readFileSync(LOCAL_SCRIPT);
    await uploadFile(conn, REMOTE_SCRIPT, scriptContent);
    emit({ type: 'log', data: { stream: 'stdout', text: '安装脚本已上传至 ' + REMOTE_SCRIPT + '\n' } });

    emit({ type: 'status', data: { phase: 'installing', message: '正在执行安装，过程可能持续数分钟...' } });
    const cmd = 'XUI_NONINTERACTIVE=1 ' + envPrefix(params) + 'bash ' + REMOTE_SCRIPT + ' 2>&1';
    const runCmd = uid === '0' ? cmd : 'XUI_NONINTERACTIVE=1 ' + envPrefix(params) + 'sudo -E bash ' + REMOTE_SCRIPT + ' 2>&1';

    const exitCode = await ssh.exec(conn, runCmd, (type, data) => {
      if (type === 'stdout' || type === 'stderr') {
        emit({ type: 'log', data: { stream: type, text: stripAnsi(data) } });
      }
    });

    if (exitCode !== 0) {
      emit({ type: 'log', data: { stream: 'stderr', text: '\n安装脚本退出码非 0（' + exitCode + '），安装可能未完成。\n' } });
    }

    emit({ type: 'status', data: { phase: 'result', message: '正在读取安装结果...' } });
    const resRaw = await ssh.execCollect(conn, 'cat ' + RESULT_FILE + ' 2>/dev/null', 8000);
    const parsed = parseResultEnv(resRaw.stdout);

    if (!parsed.XUI_PANEL_PORT) {
      const s = await ssh.execCollect(conn, '/usr/local/x-ui/x-ui setting -show true 2>/dev/null', 8000);
      const portMatch = s.stdout.match(/port:\s*(\d+)/);
      const pathMatch = s.stdout.match(/webBasePath:\s*(\S+)/);
      if (portMatch) parsed.XUI_PANEL_PORT = portMatch[1];
      if (pathMatch) parsed.XUI_WEB_BASE_PATH = pathMatch[1].replace(/^\//, '');
    }

    const host = opts.host;
    const result = {
      panelPort: parsed.XUI_PANEL_PORT || params.XUI_PANEL_PORT,
      webBasePath: parsed.XUI_WEB_BASE_PATH || params.XUI_WEB_BASE_PATH,
      username: parsed.XUI_USERNAME || params.XUI_USERNAME,
      password: parsed.XUI_PASSWORD || params.XUI_PASSWORD,
      accessUrl: parsed.XUI_ACCESS_URL || ('http://' + host + ':' + (parsed.XUI_PANEL_PORT || params.XUI_PANEL_PORT) + (parsed.XUI_WEB_BASE_PATH || params.XUI_WEB_BASE_PATH) + '/'),
      apiToken: parsed.XUI_API_TOKEN || '',
      dbType: parsed.XUI_DB_TYPE || ''
    };

    emit({ type: 'status', data: { phase: 'done', message: '安装完成' } });
    emit({ type: 'result', data: result });
    return result;
  } catch (e) {
    emit({ type: 'log', data: { stream: 'stderr', text: '\n错误：' + friendlyError(e) + '\n' } });
    emit({ type: 'status', data: { phase: 'error', message: friendlyError(e) } });
    throw e;
  } finally {
    if (conn) { try { conn.end(); } catch (x) {} }
  }
}

function publicParams(p) {
  return {
    port: p.XUI_PANEL_PORT,
    webBasePath: p.XUI_WEB_BASE_PATH,
    username: p.XUI_USERNAME
  };
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function uploadFile(conn, remotePath, buffer) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const ws = sftp.createWriteStream(remotePath);
      ws.on('close', () => resolve());
      ws.on('error', reject);
      ws.end(buffer);
    });
  });
}

module.exports = { testConnection, runInstall, buildRandomParams, parseResultEnv, friendlyError };
