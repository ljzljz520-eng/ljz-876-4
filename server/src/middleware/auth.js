const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'compliance-platform-secret-key-2026';

function signToken(user) {
  return jwt.sign(
    { id: user.id, employee_no: user.employee_no, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function rolesAllowed(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '无权限执行此操作' });
    }
    next();
  };
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

function audit(db, { userId, action, targetType, targetId, detail, ip }) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, target_type, target_id, detail, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId ?? null, action, targetType ?? null, targetId ?? null, detail ?? null, ip ?? null);
}

module.exports = { signToken, authRequired, rolesAllowed, getClientIp, audit, JWT_SECRET };
