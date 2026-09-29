const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, rolesAllowed, getClientIp, audit } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 用户列表
router.get('/', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const { keyword, department, high_risk, role } = req.query;
  let sql = 'SELECT id, employee_no, name, department, position, is_high_risk, role, active, created_at FROM users WHERE 1=1';
  const params = [];
  if (keyword) {
    sql += ' AND (name LIKE ? OR employee_no LIKE ? OR position LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (high_risk !== undefined && high_risk !== '') { sql += ' AND is_high_risk = ?'; params.push(high_risk === 'true' ? 1 : 0); }
  if (role) { sql += ' AND role = ?'; params.push(role); }
  sql += ' ORDER BY id ASC';
  const users = db.prepare(sql).all(...params).map(u => ({ ...u, is_high_risk: !!u.is_high_risk, active: !!u.active }));
  res.json(users);
});

// 部门列表
router.get('/departments', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const depts = db.prepare('SELECT DISTINCT department FROM users ORDER BY department').all().map(d => d.department);
  res.json(depts);
});

// 创建用户
router.post('/', rolesAllowed('admin'), (req, res) => {
  const { employee_no, name, department, position, is_high_risk, role, password } = req.body;
  if (!employee_no || !name || !department || !position) {
    return res.status(400).json({ error: '请填写完整信息（工号、姓名、部门、岗位）' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE employee_no = ?').get(employee_no);
  if (exists) return res.status(400).json({ error: '工号已存在' });
  const pwd = password || '123456';
  const hash = bcrypt.hashSync(pwd, 10);
  const result = db.prepare(
    `INSERT INTO users (employee_no, name, department, position, is_high_risk, role, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(employee_no, name, department, position, is_high_risk ? 1 : 0, role || 'employee', hash);
  audit(db, { userId: req.user.id, action: 'create_user', targetType: 'user', targetId: result.lastInsertRowid, detail: `创建用户 ${name}(${employee_no})`, ip: getClientIp(req) });
  res.json({ id: result.lastInsertRowid, message: '用户创建成功，初始密码：' + pwd });
});

// 更新用户
router.put('/:id', rolesAllowed('admin'), (req, res) => {
  const { name, department, position, is_high_risk, role, active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare(
    `UPDATE users SET name = ?, department = ?, position = ?, is_high_risk = ?, role = ?, active = ? WHERE id = ?`
  ).run(
    name ?? user.name,
    department ?? user.department,
    position ?? user.position,
    is_high_risk !== undefined ? (is_high_risk ? 1 : 0) : user.is_high_risk,
    role ?? user.role,
    active !== undefined ? (active ? 1 : 0) : user.active,
    user.id
  );
  audit(db, { userId: req.user.id, action: 'update_user', targetType: 'user', targetId: user.id, detail: `更新用户 ${user.name}`, ip: getClientIp(req) });
  res.json({ message: '用户信息已更新' });
});

// 重置密码
router.post('/:id/reset-password', rolesAllowed('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const pwd = '123456';
  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  audit(db, { userId: req.user.id, action: 'reset_password', targetType: 'user', targetId: user.id, detail: `重置 ${user.name} 的密码`, ip: getClientIp(req) });
  res.json({ message: `密码已重置为：${pwd}` });
});

// 删除用户
router.delete('/:id', rolesAllowed('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.id === req.user.id) return res.status(400).json({ error: '不能删除自己的账号' });
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  audit(db, { userId: req.user.id, action: 'delete_user', targetType: 'user', targetId: user.id, detail: `删除用户 ${user.name}(${user.employee_no})`, ip: getClientIp(req) });
  res.json({ message: '用户已删除' });
});

module.exports = router;
