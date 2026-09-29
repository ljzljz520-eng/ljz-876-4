const express = require('express');
const db = require('../db');
const { requireAuth, createUser, hashPassword, newSalt } = require('../auth');
const { audit } = require('../evidence');

const router = express.Router();

// 用户管理（管理员；法务/审计只读）
router.get('/users', requireAuth(['admin', 'legal', 'audit']), (req, res) => {
  const users = db
    .prepare(
      `SELECT id,username,full_name,department,position,high_risk,role,active,created_at
       FROM users ORDER BY id`
    )
    .all();
  res.json(users.map((u) => ({ ...u, high_risk: !!u.high_risk })));
});

router.post('/users', requireAuth(['admin']), (req, res) => {
  const { username, password, full_name, department, position, high_risk, role } = req.body || {};
  if (!username || !password || !full_name || !department || !position)
    return res.status(400).json({ error: '账号、密码、姓名、部门、岗位均必填' });
  if (!['employee', 'legal', 'audit', 'admin'].includes(role))
    return res.status(400).json({ error: '角色不合法' });
  if (db.prepare('SELECT id FROM users WHERE username=?').get(username))
    return res.status(409).json({ error: '账号已存在' });
  const id = createUser({ username, password, full_name, department, position, high_risk: !!high_risk, role });
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'USER_CREATE', entity: 'user',
    entityId: id, detail: { username, full_name, department, position, high_risk: !!high_risk, role },
    ip: req.clientIp });
  res.json({ id });
});

router.put('/users/:id', requireAuth(['admin']), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const b = req.body || {};
  const sets = [];
  const vals = [];
  for (const f of ['full_name', 'department', 'position', 'role']) {
    if (b[f] !== undefined) { sets.push(`${f}=?`); vals.push(b[f]); }
  }
  if (b.high_risk !== undefined) { sets.push('high_risk=?'); vals.push(b.high_risk ? 1 : 0); }
  if (b.active !== undefined) { sets.push('active=?'); vals.push(b.active ? 1 : 0); }
  if (b.password) {
    const salt = newSalt();
    sets.push('salt=?', 'password_hash=?');
    vals.push(salt, hashPassword(String(b.password), salt));
  }
  if (!sets.length) return res.json({ ok: true });
  vals.push(user.id);
  db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals);
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'USER_UPDATE', entity: 'user',
    entityId: user.id, detail: { fields: Object.keys(b) }, ip: req.clientIp });
  res.json({ ok: true });
});

// 所有测验的原始事件审计视图（审计监察）
router.get('/events', requireAuth(['admin', 'legal', 'audit']), (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.id,e.attempt_id,e.event_type,e.actor_id,e.occurred_at,e.ip_address,e.prev_hash,e.record_hash,
              a.quiz_id, u.full_name AS actor_name, q.title AS quiz_title
       FROM attempt_events e
       JOIN attempts a ON a.id=e.attempt_id
       JOIN users u ON u.id=e.actor_id
       JOIN quizzes q ON q.id=a.quiz_id
       ORDER BY e.id DESC LIMIT 300`
    )
    .all();
  res.json(rows);
});

module.exports = router;
