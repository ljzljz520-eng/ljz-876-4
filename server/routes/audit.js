const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// 审计日志查询（审计/法务/管理员）
router.get('/logs', requireAuth(['admin', 'legal', 'audit']), (req, res) => {
  const { action, entity, actor_id, from, to } = req.query;
  const where = [];
  const params = [];
  if (action) { where.push('action=?'); params.push(action); }
  if (entity) { where.push('entity=?'); params.push(entity); }
  if (actor_id) { where.push('actor_id=?'); params.push(actor_id); }
  if (from) { where.push("created_at >= ?"); params.push(from); }
  if (to) { where.push("created_at <= ?"); params.push(to); }
  const sql = `SELECT * FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY id DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
