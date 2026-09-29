const express = require('express');
const db = require('../db');
const { authRequired, rolesAllowed, getClientIp, audit } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 测验列表（员工看已发布的；管理员/法务/审计看全部）
router.get('/', (req, res) => {
  const { status, category, scope } = req.query;
  let sql = `SELECT q.*, u.name AS creator_name,
    (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
    (SELECT COUNT(*) FROM quiz_records WHERE quiz_id = q.id AND status = 'signed') AS signed_count
    FROM quizzes q LEFT JOIN users u ON q.created_by = u.id WHERE 1=1`;
  const params = [];
  if (scope === 'mine' || req.user.role === 'employee') {
    sql += " AND q.status = 'published'";
  }
  if (status) { sql += ' AND q.status = ?'; params.push(status); }
  if (category) { sql += ' AND q.category = ?'; params.push(category); }
  sql += ' ORDER BY q.created_at DESC';
  const quizzes = db.prepare(sql).all(...params);
  res.json(quizzes);
});

// 测验详情（含题目；员工作答时不返回正确答案）
router.get('/:id', (req, res) => {
  const quiz = db.prepare('SELECT q.*, u.name AS creator_name FROM quizzes q LEFT JOIN users u ON q.created_by = u.id WHERE q.id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  const questions = db.prepare('SELECT id, type, content, options, score, sort_order FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC').all(quiz.id);
  const isManager = ['admin', 'legal', 'audit'].includes(req.user.role);
  const result = { ...quiz, questions: questions.map(q => ({ ...q, options: JSON.parse(q.options) })) };
  if (isManager) {
    result.questions = db.prepare('SELECT id, type, content, options, correct_answer, score, sort_order FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC').all(quiz.id)
      .map(q => ({ ...q, options: JSON.parse(q.options), correct_answer: JSON.parse(q.correct_answer) }));
  }
  res.json(result);
});

// 创建测验（法务/审计/管理员）
router.post('/', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const { title, category, description, passing_score, high_risk_required_score, time_limit, questions } = req.body;
  if (!title || !category) return res.status(400).json({ error: '请填写测验标题和分类' });
  const result = db.prepare(
    `INSERT INTO quizzes (title, category, description, passing_score, high_risk_required_score, time_limit, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`
  ).run(title, category, description || '', passing_score ?? 60, high_risk_required_score ?? 90, time_limit ?? 0, req.user.id);
  const quizId = result.lastInsertRowid;
  if (Array.isArray(questions)) {
    const insertQ = db.prepare('INSERT INTO questions (quiz_id, type, content, options, correct_answer, score, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    questions.forEach((q, i) => {
      insertQ.run(quizId, q.type || 'single', q.content, JSON.stringify(q.options || []), JSON.stringify(q.correct_answer || []), q.score || 5, i);
    });
  }
  audit(db, { userId: req.user.id, action: 'create_quiz', targetType: 'quiz', targetId: quizId, detail: `创建测验《${title}》`, ip: getClientIp(req) });
  res.json({ id: quizId, message: '测验创建成功（草稿）' });
});

// 更新测验
router.put('/:id', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  if (quiz.status === 'published') return res.status(400).json({ error: '已发布的测验不能编辑，请先撤回' });
  const { title, category, description, passing_score, high_risk_required_score, time_limit, questions } = req.body;
  db.prepare(
    `UPDATE quizzes SET title = ?, category = ?, description = ?, passing_score = ?, high_risk_required_score = ?, time_limit = ? WHERE id = ?`
  ).run(title ?? quiz.title, category ?? quiz.category, description ?? quiz.description, passing_score ?? quiz.passing_score, high_risk_required_score ?? quiz.high_risk_required_score, time_limit ?? quiz.time_limit, quiz.id);
  if (Array.isArray(questions)) {
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quiz.id);
    const insertQ = db.prepare('INSERT INTO questions (quiz_id, type, content, options, correct_answer, score, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    questions.forEach((q, i) => {
      insertQ.run(quiz.id, q.type || 'single', q.content, JSON.stringify(q.options || []), JSON.stringify(q.correct_answer || []), q.score || 5, i);
    });
  }
  audit(db, { userId: req.user.id, action: 'update_quiz', targetType: 'quiz', targetId: quiz.id, detail: `更新测验《${quiz.title}》`, ip: getClientIp(req) });
  res.json({ message: '测验已更新' });
});

// 发布测验
router.post('/:id/publish', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = ?').get(quiz.id).c;
  if (count === 0) return res.status(400).json({ error: '请至少添加一道题目再发布' });
  db.prepare("UPDATE quizzes SET status = 'published', published_at = datetime('now', 'localtime') WHERE id = ?").run(quiz.id);
  audit(db, { userId: req.user.id, action: 'publish_quiz', targetType: 'quiz', targetId: quiz.id, detail: `发布测验《${quiz.title}》`, ip: getClientIp(req) });
  res.json({ message: '测验已发布' });
});

// 撤回/归档测验
router.post('/:id/archive', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  db.prepare("UPDATE quizzes SET status = 'archived' WHERE id = ?").run(quiz.id);
  audit(db, { userId: req.user.id, action: 'archive_quiz', targetType: 'quiz', targetId: quiz.id, detail: `归档测验《${quiz.title}》`, ip: getClientIp(req) });
  res.json({ message: '测验已归档' });
});

// 删除测验
router.delete('/:id', rolesAllowed('admin'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quiz.id);
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(quiz.id);
  audit(db, { userId: req.user.id, action: 'delete_quiz', targetType: 'quiz', targetId: quiz.id, detail: `删除测验《${quiz.title}》`, ip: getClientIp(req) });
  res.json({ message: '测验已删除' });
});

// 某测验的详细学习记录（证据列表，不只看人数）
router.get('/:id/records', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const records = db.prepare(
    `SELECT r.*, u.name, u.employee_no, u.department, u.position, u.is_high_risk,
     s.signed_name, s.signed_at, s.certificate_no, s.ip_address AS sign_ip
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.quiz_id = ? AND r.status = 'signed'
     ORDER BY s.signed_at DESC`
  ).all(req.params.id).map(r => ({ ...r, is_high_risk: !!r.is_high_risk }));
  res.json(records);
});

module.exports = router;
