const express = require('express');
const db = require('../db');
const { login, logout, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入账号和密码' });
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const token = login(String(username), String(password), ip);
  if (!token) return res.status(401).json({ error: '账号或密码错误，或账号已停用' });
  const user = db.prepare("SELECT id,username,full_name,department,position,high_risk,role FROM users WHERE username=?").get(username);
  res.json({ token, user });
});

router.post('/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
    if (session) {
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      logout(token, user, ip);
    }
  }
  res.json({ ok: true });
});

router.get('/me', requireAuth(), (req, res) => {
  const { id, username, full_name, department, position, high_risk, role } = req.user;
  res.json({ id, username, full_name, department, position, high_risk: !!high_risk, role });
});

module.exports = router;
