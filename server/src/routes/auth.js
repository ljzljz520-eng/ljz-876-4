const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired, getClientIp, audit } = require('../middleware/auth');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { employee_no, password } = req.body;
  if (!employee_no || !password) {
    return res.status(400).json({ error: '请输入工号和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE employee_no = ?').get(employee_no);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    audit(db, { userId: user?.id, action: 'login_failed', detail: `工号 ${employee_no} 登录失败`, ip: getClientIp(req) });
    return res.status(401).json({ error: '工号或密码错误' });
  }
  if (!user.active) {
    return res.status(403).json({ error: '账号已停用，请联系管理员' });
  }
  const token = signToken(user);
  audit(db, { userId: user.id, action: 'login_success', detail: `${user.name} 登录成功`, ip: getClientIp(req) });
  res.json({
    token,
    user: {
      id: user.id,
      employee_no: user.employee_no,
      name: user.name,
      department: user.department,
      position: user.position,
      is_high_risk: !!user.is_high_risk,
      role: user.role,
    },
  });
});

// 获取当前用户信息
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, employee_no, name, department, position, is_high_risk, role, active, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ ...user, is_high_risk: !!user.is_high_risk });
});

// 修改密码
router.post('/change-password', authRequired, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ error: '请填写原密码和新密码' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  audit(db, { userId: user.id, action: 'change_password', detail: `${user.name} 修改密码`, ip: getClientIp(req) });
  res.json({ message: '密码修改成功' });
});

module.exports = router;
