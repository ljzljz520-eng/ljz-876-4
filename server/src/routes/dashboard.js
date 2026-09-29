const express = require('express');
const db = require('../db');
const { authRequired, rolesAllowed } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 管理仪表盘：不只看通过人数，要看完整的学习证据
router.get('/stats', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const totalEmployees = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'employee' AND active = 1").get().c;
  const highRiskCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'employee' AND is_high_risk = 1 AND active = 1").get().c;
  const publishedQuizzes = db.prepare("SELECT COUNT(*) AS c FROM quizzes WHERE status = 'published'").get().c;
  const totalSigned = db.prepare("SELECT COUNT(*) AS c FROM quiz_records WHERE status = 'signed'").get().c;

  // 高风险岗位达标情况（按人）
  const highRiskUsers = db.prepare(
    `SELECT u.id, u.name, u.employee_no, u.department, u.position,
     (SELECT COUNT(*) FROM quiz_records r JOIN quizzes q ON r.quiz_id = q.id WHERE r.user_id = u.id AND r.status = 'signed') AS signed_count,
     (SELECT COUNT(*) FROM quiz_records r JOIN quizzes q ON r.quiz_id = q.id WHERE r.user_id = u.id AND r.status = 'signed' AND r.high_risk_passed = 0) AS failed_count
     FROM users u WHERE u.role = 'employee' AND u.is_high_risk = 1 AND u.active = 1`
  ).all();

  // 按部门统计签署情况
  const deptStats = db.prepare(
    `SELECT u.department,
     COUNT(DISTINCT u.id) AS employee_count,
     COUNT(DISTINCT CASE WHEN r.status = 'signed' THEN r.id END) AS signed_count
     FROM users u LEFT JOIN quiz_records r ON r.user_id = u.id
     WHERE u.role = 'employee' AND u.active = 1
     GROUP BY u.department ORDER BY signed_count DESC`
  ).all();

  // 按测验统计
  const quizStats = db.prepare(
    `SELECT q.id, q.title, q.category, q.passing_score, q.high_risk_required_score,
     (SELECT COUNT(*) FROM quiz_records WHERE quiz_id = q.id AND status = 'signed') AS signed_count,
     (SELECT COUNT(*) FROM quiz_records WHERE quiz_id = q.id AND status = 'signed' AND passed = 0) AS failed_count,
     (SELECT COUNT(*) FROM quiz_records WHERE quiz_id = q.id AND status = 'in_progress') AS in_progress_count
     FROM quizzes q WHERE q.status = 'published' ORDER BY q.published_at DESC`
  ).all();

  // 最近签署动态（证据流）
  const recentSigns = db.prepare(
    `SELECT r.id, u.name, u.employee_no, u.department, q.title AS quiz_title, q.category,
     r.score, s.signed_at, s.certificate_no, s.ip_address
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     JOIN quizzes q ON r.quiz_id = q.id
     JOIN signatures s ON s.record_id = r.id
     WHERE r.status = 'signed'
     ORDER BY s.signed_at DESC LIMIT 10`
  ).all();

  // 未完成学习的员工（高风险优先）
  const pendingUsers = db.prepare(
    `SELECT * FROM (
      SELECT u.id, u.name, u.employee_no, u.department, u.position, u.is_high_risk,
       (SELECT GROUP_CONCAT(q.title) FROM quizzes q WHERE q.status = 'published'
        AND NOT EXISTS (SELECT 1 FROM quiz_records r WHERE r.quiz_id = q.id AND r.user_id = u.id AND r.status = 'signed')) AS pending_quizzes
      FROM users u WHERE u.role = 'employee' AND u.active = 1
    ) WHERE pending_quizzes IS NOT NULL
    ORDER BY is_high_risk DESC, department ASC`
  ).all().map(u => ({ ...u, is_high_risk: !!u.is_high_risk, pending_quizzes: u.pending_quizzes ? u.pending_quizzes.split(',') : [] }));

  res.json({
    overview: { totalEmployees, highRiskCount, publishedQuizzes, totalSigned },
    highRiskUsers,
    deptStats,
    quizStats,
    recentSigns,
    pendingUsers,
  });
});

// 员工个人仪表盘
router.get('/my-stats', authRequired, (req, res) => {
  const signed = db.prepare("SELECT COUNT(*) AS c FROM quiz_records WHERE user_id = ? AND status = 'signed'").get(req.user.id).c;
  const inProgress = db.prepare("SELECT COUNT(*) AS c FROM quiz_records WHERE user_id = ? AND status = 'in_progress'").get(req.user.id).c;
  const available = db.prepare("SELECT COUNT(*) AS c FROM quizzes WHERE status = 'published'").get().c;
  const records = db.prepare(
    `SELECT r.id, r.score, r.status, r.completed_at, q.title, q.category,
     s.signed_at, s.certificate_no
     FROM quiz_records r JOIN quizzes q ON r.quiz_id = q.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.user_id = ? ORDER BY r.started_at DESC`
  ).all(req.user.id);
  res.json({ signed, inProgress, available, records });
});

// 操作审计日志
router.get('/audit-logs', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const { action, keyword } = req.query;
  let sql = `SELECT a.*, u.name AS operator_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1`;
  const params = [];
  if (action) { sql += ' AND a.action = ?'; params.push(action); }
  if (keyword) { sql += ' AND (a.detail LIKE ? OR u.name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  sql += ' ORDER BY a.id DESC LIMIT 500';
  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

module.exports = router;
