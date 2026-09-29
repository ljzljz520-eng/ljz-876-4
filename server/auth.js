const crypto = require('crypto');
const db = require('./db');
const { audit } = require('./evidence');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createUser({ username, password, full_name, department, position, high_risk, role }) {
  const salt = newSalt();
  const ph = hashPassword(password, salt);
  return db
    .prepare(
      `INSERT INTO users (username,full_name,department,position,high_risk,password_hash,salt,role)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(username, full_name, department, position, high_risk ? 1 : 0, ph, salt, role).lastInsertRowid;
}

function verifyPassword(user, password) {
  const expected = hashPassword(password, user.salt);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(user.password_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(userId, ip) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  db.prepare('INSERT INTO sessions (token,user_id,expires_at,ip_address) VALUES (?,?,?,?)').run(
    token,
    userId,
    expiresAt,
    ip
  );
  return token;
}

function getUserFromReq(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!session || new Date(session.expires_at) < new Date()) return null;
  return db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(session.user_id) || null;
}

function requireAuth(roles) {
  return (req, res, next) => {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: '未登录或会话已过期' });
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: '无权限执行该操作' });
    }
    req.user = user;
    req.clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    req.ua = req.headers['user-agent'] || '';
    next();
  };
}

// 登录失败也留审计痕迹
function login(username, password, ip) {
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || !verifyPassword(user, password)) {
    audit({ actorId: user?.id || null, actorName: username, action: 'LOGIN_FAILED', entity: 'session', ip });
    return null;
  }
  if (!user.active) return null;
  audit({ actorId: user.id, actorName: user.full_name, action: 'LOGIN_SUCCESS', entity: 'session', ip });
  return createSession(user.id, ip);
}

function logout(token, user, ip) {
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  audit({ actorId: user.id, actorName: user.full_name, action: 'LOGOUT', entity: 'session', ip });
}

module.exports = { createUser, login, logout, getUserFromReq, requireAuth, hashPassword, newSalt };
