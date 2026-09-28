/**
 * 随机参数生成模块
 * 用于在非交互模式下，替代官方脚本的交互式提问，
 * 自动生成随机的用户名、密码、面板端口、Web 基础路径等。
 */
const crypto = require('crypto');

// 生成指定长度的随机字符串（大小写字母 + 数字）
function randStr(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

// 生成随机小写字符串（用于 web 基础路径）
function randLower(len) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

// 生成随机端口（10000 - 60000）
function randPort() {
  return 10000 + Math.floor(Math.random() * 50000);
}

// 验证是否合法端口
function isValidPort(p) {
  const n = parseInt(p, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

module.exports = { randStr, randLower, randPort, isValidPort };
